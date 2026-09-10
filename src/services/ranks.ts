import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import type { Rank } from '@/types';

/** Inspection ranks/tiers (דרג). Global, reorderable, admin-managed. */

export async function listRanks(includeInactive = false): Promise<Rank[]> {
  const all = await db.ranks.toArray();
  const filtered = includeInactive ? all : all.filter((r) => r.active);
  return filtered.sort((a, b) => a.sort_order - b.sort_order);
}

export async function getRank(id: string): Promise<Rank | undefined> {
  return db.ranks.get(id);
}

export async function createRank(name: string): Promise<Rank> {
  const existing = await db.ranks.toArray();
  const r: Rank = {
    id: newId(),
    name: name.trim(),
    active: true,
    sort_order: existing.length,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.ranks.add(r);
  return r;
}

export async function updateRank(
  id: string,
  patch: Partial<Pick<Rank, 'name' | 'active'>>
): Promise<void> {
  const clean: Partial<Rank> = { updated_at: nowIso() };
  if (patch.name !== undefined) clean.name = patch.name.trim();
  if (patch.active !== undefined) clean.active = patch.active;
  await db.ranks.update(id, clean);
}

export async function reorderRanks(orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) => db.ranks.update(id, { sort_order: i })));
}

export async function moveRank(id: string, dir: 'up' | 'down'): Promise<void> {
  const ranks = await listRanks(true);
  const idx = ranks.findIndex((r) => r.id === id);
  const swap = dir === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= ranks.length) return;
  const ids = ranks.map((r) => r.id);
  [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
  await reorderRanks(ids);
}

/** Ensure at least one rank exists; returns a usable rank id. */
export async function ensureDefaultRank(): Promise<string> {
  const all = await listRanks(true);
  const active = all.find((r) => r.active) ?? all[0];
  if (active) return active.id;
  return (await createRank('דרג א׳')).id;
}
