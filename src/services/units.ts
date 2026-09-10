import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import type { Unit } from '@/types';

/** Specific units (יחידה) belonging to a system type. Admin-managed. */

export async function listUnits(includeInactive = false): Promise<Unit[]> {
  const all = await db.units.toArray();
  const filtered = includeInactive ? all : all.filter((u) => u.active);
  return filtered.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'he'));
}

export async function listUnitsBySystem(
  systemId: string,
  includeInactive = false
): Promise<Unit[]> {
  const all = await db.units.where('system_id').equals(systemId).toArray();
  const filtered = includeInactive ? all : all.filter((u) => u.active);
  return filtered.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'he'));
}

export async function getUnit(id: string): Promise<Unit | undefined> {
  return db.units.get(id);
}

export async function createUnit(systemId: string, name: string): Promise<Unit> {
  const existing = await listUnitsBySystem(systemId, true);
  const u: Unit = {
    id: newId(),
    system_id: systemId,
    name: name.trim(),
    active: true,
    sort_order: existing.length,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.units.add(u);
  return u;
}

export async function updateUnit(
  id: string,
  patch: Partial<Pick<Unit, 'name' | 'active' | 'system_id'>>
): Promise<void> {
  const clean: Partial<Unit> = { updated_at: nowIso() };
  if (patch.name !== undefined) clean.name = patch.name.trim();
  if (patch.active !== undefined) clean.active = patch.active;
  if (patch.system_id !== undefined) clean.system_id = patch.system_id;
  await db.units.update(id, clean);
}

export async function countUnitsInSystem(systemId: string): Promise<number> {
  return db.units.where('system_id').equals(systemId).count();
}
