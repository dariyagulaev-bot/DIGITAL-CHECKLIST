import { db } from '@/data/db';
import { listRanks } from './ranks';
import { certStatus, allowedRankIds } from './certifications';
import { buildPrereqGraph } from './prerequisites';
import { todayStr } from './dates';
import type {
  CertStatus,
  EffectiveCertStatus,
  Rank,
  RankCertification,
  SystemRankPrerequisite,
  UserSystemRank,
} from '@/types';

/**
 * Effective competency engine (כשירות אפקטיבית). Computes, per (user, system,
 * rank), the ACTUAL current status — not merely "was ever certified" — by
 * combining:
 *   1. the rank's own certification (granular rank_certifications row if present,
 *      else the legacy user_system_ranks max-rank window that covers it), and
 *   2. the system's prerequisite hierarchy: a higher rank is only effectively
 *      active while every prerequisite rank is itself effectively active.
 *
 * When a prerequisite lapses, dependent ranks become 'inactive_prereq' WITHOUT
 * deleting any record — and auto-recover the moment the prerequisite is renewed.
 * All of this is enforced in the business layer; VERO gates on it.
 */

/** A status counts as "active" (usable for new work / as a satisfied prereq). */
export function isActiveStatus(s: EffectiveCertStatus): boolean {
  return s === 'valid' || s === 'needs_renewal';
}

export interface SystemCompetencyInput {
  ranksAsc: Pick<Rank, 'id' | 'sort_order'>[];
  legacy?: Pick<UserSystemRank, 'max_rank_id' | 'expires_at'> | null;
  rankCerts?: Pick<RankCertification, 'rank_id' | 'expires_at'>[];
  prereqEdges: SystemRankPrerequisite[];
  now?: string;
}

/**
 * Pure core: compute base + effective status for every rank of one system.
 * Base status for a rank:
 *   • granular rank_certifications row for that rank → its date status;
 *   • else legacy max-rank covers it → the legacy row's date status;
 *   • else 'none'.
 * Effective status then applies the prerequisite cascade (memoized DFS, cycle-safe).
 */
export function computeSystemCompetency(input: SystemCompetencyInput): {
  base: Map<string, CertStatus>;
  effective: Map<string, EffectiveCertStatus>;
} {
  const now = input.now ?? todayStr();
  const ranksAsc = [...input.ranksAsc].sort((a, b) => a.sort_order - b.sort_order);
  const covered = allowedRankIds(input.legacy?.max_rank_id ?? null, ranksAsc);
  const legacyStatus: CertStatus = input.legacy
    ? certStatus({ expires_at: input.legacy.expires_at }, now)
    : 'none';
  const rankCertMap = new Map((input.rankCerts ?? []).map((rc) => [rc.rank_id, rc]));

  const base = new Map<string, CertStatus>();
  for (const r of ranksAsc) {
    const rc = rankCertMap.get(r.id);
    if (rc) base.set(r.id, certStatus({ expires_at: rc.expires_at }, now));
    else if (covered.has(r.id)) base.set(r.id, legacyStatus === 'none' ? 'valid' : legacyStatus);
    else base.set(r.id, 'none');
  }

  const graph = buildPrereqGraph(input.prereqEdges);
  const effective = new Map<string, EffectiveCertStatus>();
  const inProgress = new Set<string>();

  const resolve = (rankId: string): EffectiveCertStatus => {
    const memo = effective.get(rankId);
    if (memo) return memo;
    if (inProgress.has(rankId)) {
      // Defensive against a bad (cyclic) config — treat as unmet rather than loop.
      return 'inactive_prereq';
    }
    inProgress.add(rankId);
    const b = base.get(rankId) ?? 'none';
    let result: EffectiveCertStatus;
    if (b === 'none' || b === 'expired') {
      result = b;
    } else {
      // b is valid / needs_renewal — check prerequisites.
      let allMet = true;
      for (const prereq of graph.get(rankId) ?? []) {
        if (!isActiveStatus(resolve(prereq))) {
          allMet = false;
          break;
        }
      }
      result = allMet ? b : 'inactive_prereq';
    }
    inProgress.delete(rankId);
    effective.set(rankId, result);
    return result;
  };

  for (const r of ranksAsc) resolve(r.id);
  return { base, effective };
}

/** Load the inputs for one (user, system) and compute effective status per rank. */
export async function systemCompetency(
  userId: string,
  systemId: string,
  now?: string
): Promise<Map<string, EffectiveCertStatus>> {
  const [ranks, legacy, rankCerts, prereqEdges] = await Promise.all([
    listRanks(true),
    db.user_system_ranks.where('[user_id+system_id]').equals([userId, systemId]).first(),
    db.rank_certifications.where('[user_id+system_id]').equals([userId, systemId]).toArray(),
    db.system_rank_prerequisites.where('system_id').equals(systemId).toArray(),
  ]);
  return computeSystemCompetency({
    ranksAsc: ranks,
    legacy: legacy ?? null,
    rankCerts,
    prereqEdges,
    now,
  }).effective;
}

/** Effective status of a single (user, system, rank). */
export async function effectiveRankStatus(
  userId: string,
  systemId: string,
  rankId: string,
  now?: string
): Promise<EffectiveCertStatus> {
  const map = await systemCompetency(userId, systemId, now);
  return map.get(rankId) ?? 'none';
}

/** Is (user, system, rank) EFFECTIVELY certified right now (active + prereqs met)? */
export async function isEffectivelyCertified(
  userId: string,
  systemId: string,
  rankId: string,
  now?: string
): Promise<boolean> {
  return isActiveStatus(await effectiveRankStatus(userId, systemId, rankId, now));
}

/** Highest effectively-active rank id for (user, system), or null if none. */
export async function effectiveMaxActiveRankId(
  userId: string,
  systemId: string,
  now?: string
): Promise<string | null> {
  const [ranks, map] = await Promise.all([
    listRanks(true),
    systemCompetency(userId, systemId, now),
  ]);
  const asc = [...ranks].sort((a, b) => a.sort_order - b.sort_order);
  let best: string | null = null;
  for (const r of asc) if (isActiveStatus(map.get(r.id) ?? 'none')) best = r.id;
  return best;
}

/** Human label for an effective status (statuses the spec names). */
export function effectiveStatusLabel(s: EffectiveCertStatus): string {
  switch (s) {
    case 'valid':
      return 'מוסמך ופעיל';
    case 'needs_renewal':
      return 'מוסמך — עומד לפוג';
    case 'expired':
      return 'פג תוקף';
    case 'inactive_prereq':
      return 'לא פעיל עקב פגות תנאי קדם';
    default:
      return 'לא הוסמך';
  }
}
