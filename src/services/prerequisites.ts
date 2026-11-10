import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import { logAudit } from './audit';
import type { SystemRankPrerequisite } from '@/types';

/**
 * Dynamic rank hierarchy (היררכיית דרגים / תנאי קדם) — admin-configured PER
 * SYSTEM, never hard-coded. To be certified for (system, rank) the user must
 * hold an effectively-active certification for every prerequisite rank. Edges
 * use the existing ranks and MUST stay acyclic (cycle detection on save).
 *
 * All validation is here in the business layer, not only in the UI.
 */

export const PREREQ_CYCLE_ERROR =
  'לא ניתן להגדיר תנאי קדם זה — הוא יוצר תלות מעגלית בין הדרגים.';
export const PREREQ_SELF_ERROR = 'דרג אינו יכול להיות תנאי קדם של עצמו.';

export async function listPrerequisites(systemId: string): Promise<SystemRankPrerequisite[]> {
  return db.system_rank_prerequisites.where('system_id').equals(systemId).toArray();
}

export async function listAllPrerequisites(): Promise<SystemRankPrerequisite[]> {
  return db.system_rank_prerequisites.toArray();
}

/** Direct prerequisite rank ids for (system, rank). */
export async function prerequisiteRankIds(systemId: string, rankId: string): Promise<string[]> {
  const rows = await db.system_rank_prerequisites
    .where('[system_id+rank_id]')
    .equals([systemId, rankId])
    .toArray();
  return rows.map((r) => r.prerequisite_rank_id);
}

/** Build the adjacency map rank → its direct prerequisite ranks, for a system. */
export function buildPrereqGraph(edges: SystemRankPrerequisite[]): Map<string, Set<string>> {
  const g = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!g.has(e.rank_id)) g.set(e.rank_id, new Set());
    g.get(e.rank_id)!.add(e.prerequisite_rank_id);
  }
  return g;
}

/**
 * Would adding edge (rank → prereq) create a cycle? A cycle exists if `prereq`
 * already depends (transitively) on `rank`, i.e. `rank` is reachable from
 * `prereq` by following prerequisite edges. Pure + defensive (also guards
 * against pre-existing cycles in the data).
 */
export function wouldCreateCycle(
  graph: Map<string, Set<string>>,
  rankId: string,
  prereqId: string
): boolean {
  if (rankId === prereqId) return true;
  // DFS from prereq; if we can reach rankId, adding rank→prereq closes a loop.
  const seen = new Set<string>();
  const stack = [prereqId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === rankId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of graph.get(cur) ?? []) stack.push(next);
  }
  return false;
}

/** All prerequisite ranks of (system, rank), transitively (excludes self). */
export async function transitivePrerequisites(
  systemId: string,
  rankId: string
): Promise<Set<string>> {
  const graph = buildPrereqGraph(await listPrerequisites(systemId));
  const out = new Set<string>();
  const stack = [...(graph.get(rankId) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const next of graph.get(cur) ?? []) stack.push(next);
  }
  out.delete(rankId);
  return out;
}

/** Add a prerequisite edge. Rejects self-edges and any edge that forms a cycle. */
export async function addPrerequisite(
  systemId: string,
  rankId: string,
  prerequisiteRankId: string,
  actor: { id: string; full_name: string }
): Promise<void> {
  if (rankId === prerequisiteRankId) throw new Error(PREREQ_SELF_ERROR);
  const edges = await listPrerequisites(systemId);
  // Already present → no-op (idempotent).
  if (edges.some((e) => e.rank_id === rankId && e.prerequisite_rank_id === prerequisiteRankId)) {
    return;
  }
  const graph = buildPrereqGraph(edges);
  if (wouldCreateCycle(graph, rankId, prerequisiteRankId)) throw new Error(PREREQ_CYCLE_ERROR);
  const row: SystemRankPrerequisite = {
    id: newId(),
    system_id: systemId,
    rank_id: rankId,
    prerequisite_rank_id: prerequisiteRankId,
    created_at: nowIso(),
  };
  await db.system_rank_prerequisites.add(row);
  await logAudit({
    user_id: actor.id,
    user_name: actor.full_name,
    action: 'PREREQ_ADD',
    entity_type: 'system_rank_prerequisite',
    entity_id: systemId,
    field: rankId,
    old_value: null,
    new_value: prerequisiteRankId,
  });
}

/** Remove a prerequisite edge (by system, rank, prerequisite). Audited. */
export async function removePrerequisite(
  systemId: string,
  rankId: string,
  prerequisiteRankId: string,
  actor: { id: string; full_name: string }
): Promise<void> {
  const edges = await listPrerequisites(systemId);
  const row = edges.find(
    (e) => e.rank_id === rankId && e.prerequisite_rank_id === prerequisiteRankId
  );
  if (!row) return;
  await db.system_rank_prerequisites.delete(row.id);
  await logAudit({
    user_id: actor.id,
    user_name: actor.full_name,
    action: 'PREREQ_REMOVE',
    entity_type: 'system_rank_prerequisite',
    entity_id: systemId,
    field: rankId,
    old_value: prerequisiteRankId,
    new_value: null,
  });
}

/**
 * Replace ALL prerequisite edges for (system, rank) with the given set. Validates
 * the whole resulting graph is acyclic before writing. Audited (old → new).
 */
export async function setPrerequisites(
  systemId: string,
  rankId: string,
  prerequisiteRankIds: string[],
  actor: { id: string; full_name: string }
): Promise<void> {
  const clean = [...new Set(prerequisiteRankIds)].filter((id) => id && id !== rankId);
  const all = await listPrerequisites(systemId);
  const others = all.filter((e) => e.rank_id !== rankId);
  // Validate the candidate graph (others + new edges for this rank) is acyclic.
  const candidate = buildPrereqGraph(others);
  for (const p of clean) {
    if (wouldCreateCycle(candidate, rankId, p)) throw new Error(PREREQ_CYCLE_ERROR);
    if (!candidate.has(rankId)) candidate.set(rankId, new Set());
    candidate.get(rankId)!.add(p);
  }
  const before = all
    .filter((e) => e.rank_id === rankId)
    .map((e) => e.prerequisite_rank_id)
    .sort();
  const after = [...clean].sort();
  if (before.join(',') === after.join(',')) return; // no change

  await db.transaction('rw', db.system_rank_prerequisites, async () => {
    const toDelete = all.filter((e) => e.rank_id === rankId).map((e) => e.id);
    if (toDelete.length) await db.system_rank_prerequisites.bulkDelete(toDelete);
    const now = nowIso();
    if (clean.length) {
      await db.system_rank_prerequisites.bulkAdd(
        clean.map((p) => ({
          id: newId(),
          system_id: systemId,
          rank_id: rankId,
          prerequisite_rank_id: p,
          created_at: now,
        }))
      );
    }
  });
  await logAudit({
    user_id: actor.id,
    user_name: actor.full_name,
    action: 'PREREQ_SET',
    entity_type: 'system_rank_prerequisite',
    entity_id: systemId,
    field: rankId,
    old_value: before.join(',') || '—',
    new_value: after.join(',') || '—',
  });
}
