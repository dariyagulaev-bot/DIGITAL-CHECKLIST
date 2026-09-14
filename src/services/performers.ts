import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import type { Performer } from '@/types';

/**
 * Second-performer directory (מבצע 2). Admin-managed people saved in the local
 * DB, so the מבצע 2 dropdown is driven by real data and works fully offline.
 * Disabling a performer only removes them from NEW forms — historical forms
 * keep their own name snapshot, so past documents never change.
 */

export async function listPerformers(includeInactive = false): Promise<Performer[]> {
  const all = await db.performers.toArray();
  const filtered = includeInactive ? all : all.filter((p) => p.active);
  return filtered.sort(
    (a, b) => a.sort_order - b.sort_order || a.full_name.localeCompare(b.full_name, 'he')
  );
}

/** Active performers only — what the מבצע 2 dropdown offers in new forms. */
export function listActivePerformers(): Promise<Performer[]> {
  return listPerformers(false);
}

export async function getPerformer(id: string): Promise<Performer | undefined> {
  return db.performers.get(id);
}

export async function createPerformer(fullName: string): Promise<Performer> {
  const existing = await db.performers.toArray();
  const p: Performer = {
    id: newId(),
    full_name: fullName.trim(),
    active: true,
    sort_order: existing.length,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.performers.add(p);
  return p;
}

export async function updatePerformer(
  id: string,
  patch: Partial<Pick<Performer, 'full_name' | 'active'>>
): Promise<void> {
  const clean: Partial<Performer> = { updated_at: nowIso() };
  if (patch.full_name !== undefined) clean.full_name = patch.full_name.trim();
  if (patch.active !== undefined) clean.active = patch.active;
  await db.performers.update(id, clean);
}

/** Enable/disable a performer (השבת/הפעל). */
export function setPerformerActive(id: string, active: boolean): Promise<void> {
  return updatePerformer(id, { active });
}

export async function reorderPerformers(orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) => db.performers.update(id, { sort_order: i })));
}

export async function movePerformer(id: string, dir: 'up' | 'down'): Promise<void> {
  const performers = await listPerformers(true);
  const idx = performers.findIndex((p) => p.id === id);
  const swap = dir === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= performers.length) return;
  const ids = performers.map((p) => p.id);
  [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
  await reorderPerformers(ids);
}
