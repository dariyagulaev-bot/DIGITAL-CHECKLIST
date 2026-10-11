import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import { logAudit } from './audit';
import { listRanks } from './ranks';
import { listUsersWithRoles } from './auth';
import { RoleName, type Rank, type UserSystemRank } from '@/types';

/**
 * User certifications (הסמכות): per (user, system type), the HIGHEST rank the
 * user may inspect. Ranks are HIERARCHICAL — a max rank automatically covers
 * every rank below it (ordered by Rank.sort_order). No row = ללא הסמכה.
 *
 * All gating is enforced here in the business layer, not only in the UI.
 */

export async function listCertifications(userId: string): Promise<UserSystemRank[]> {
  return db.user_system_ranks.where('user_id').equals(userId).toArray();
}

export async function listAllCertifications(): Promise<UserSystemRank[]> {
  return db.user_system_ranks.toArray();
}

export async function getMaxRankId(userId: string, systemId: string): Promise<string | null> {
  const row = await db.user_system_ranks
    .where('[user_id+system_id]')
    .equals([userId, systemId])
    .first();
  return row?.max_rank_id ?? null;
}

/** The set of rank ids a given max-rank certification covers (hierarchy). */
export function allowedRankIds(
  maxRankId: string | null,
  ranksAsc: Pick<Rank, 'id' | 'sort_order'>[]
): Set<string> {
  if (!maxRankId) return new Set();
  const max = ranksAsc.find((r) => r.id === maxRankId);
  if (!max) return new Set();
  return new Set(ranksAsc.filter((r) => r.sort_order <= max.sort_order).map((r) => r.id));
}

/**
 * Set (maxRankId) or clear (null = ללא הסמכה) a user's certification for a
 * system. Audited with the acting admin + timestamp. Because a higher rank
 * always includes the ranks below it, storing only the max rank makes an
 * illegal combination (e.g. ד׳ without ב׳) structurally impossible.
 */
export async function setCertification(
  userId: string,
  systemId: string,
  maxRankId: string | null,
  actor: { id: string; full_name: string }
): Promise<void> {
  const existing = await db.user_system_ranks
    .where('[user_id+system_id]')
    .equals([userId, systemId])
    .first();
  const now = nowIso();
  const audit = (action: string, oldV: string | null, newV: string | null) =>
    logAudit({
      user_id: actor.id,
      user_name: actor.full_name,
      action,
      entity_type: 'user_system_rank',
      entity_id: userId,
      field: systemId,
      old_value: oldV,
      new_value: newV,
    });

  if (maxRankId === null) {
    if (existing) {
      await db.user_system_ranks.delete(existing.id);
      await audit('CERT_REMOVE', existing.max_rank_id, null);
    }
    return;
  }
  if (existing) {
    if (existing.max_rank_id === maxRankId) return;
    await db.user_system_ranks.update(existing.id, { max_rank_id: maxRankId, updated_at: now });
    await audit('CERT_UPDATE', existing.max_rank_id, maxRankId);
  } else {
    await db.user_system_ranks.add({
      id: newId(),
      user_id: userId,
      system_id: systemId,
      max_rank_id: maxRankId,
      created_at: now,
      updated_at: now,
    });
    await audit('CERT_ADD', null, maxRankId);
  }
}

/** Systems the user is certified for (has any certification row). */
export async function certifiedSystemIds(userId: string): Promise<Set<string>> {
  const certs = await listCertifications(userId);
  return new Set(certs.map((c) => c.system_id));
}

/**
 * Is the user certified to run an inspection of (system, rank)?
 *  - systemId null → no system context to gate (legacy/defensive): allowed.
 *  - rankId null → the system has no meaningful rank; any certification suffices.
 * Ranks include inactive ones here so the hierarchy order is stable over time.
 */
export async function isUserCertified(
  userId: string,
  systemId: string | null,
  rankId: string | null
): Promise<boolean> {
  if (!systemId) return true;
  const maxRankId = await getMaxRankId(userId, systemId);
  if (!maxRankId) return false;
  if (!rankId) return true;
  const ranks = await listRanks(true);
  return allowedRankIds(maxRankId, ranks).has(rankId);
}

/**
 * Active PERFORMER users certified for (system, rank) — the pool the מבצע 2
 * picker (and repair-performer pickers) draw from. Excludes `excludeUserId`.
 * When `minRankId` is given instead of an exact rank, requires certification at
 * least up to that rank (used for rank-ד treatment performers).
 */
export async function listCertifiedPerformerUsers(
  systemId: string | null,
  rankId: string | null,
  excludeUserId?: string
): Promise<Array<{ id: string; full_name: string }>> {
  const users = (await listUsersWithRoles()).filter(
    (u) => u.active && u.roles.includes(RoleName.PERFORMER)
  );
  const ranks = await listRanks(true);
  const certs = await listAllCertifications();
  const byKey = new Map(certs.map((c) => [c.user_id + '|' + c.system_id, c.max_rank_id]));
  const out: Array<{ id: string; full_name: string }> = [];
  for (const u of users) {
    if (excludeUserId && u.id === excludeUserId) continue;
    if (!systemId) {
      out.push({ id: u.id, full_name: u.full_name });
      continue;
    }
    const max = byKey.get(u.id + '|' + systemId);
    if (!max) continue;
    if (rankId && !allowedRankIds(max, ranks).has(rankId)) continue;
    out.push({ id: u.id, full_name: u.full_name });
  }
  return out.sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'));
}

/** How many active PERFORMER users are certified for (system, rank). */
export async function countCertifiedPerformers(
  systemId: string | null,
  rankId: string | null,
  excludeUserId?: string
): Promise<number> {
  return (await listCertifiedPerformerUsers(systemId, rankId, excludeUserId)).length;
}
