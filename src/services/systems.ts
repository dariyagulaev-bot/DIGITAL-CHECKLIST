import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import type { System } from '@/types';

/**
 * Systems (מערכות). Each system groups the checklists (בד״חים) that belong to
 * it. Fully data-driven and admin-managed — no hard-coded system or form names.
 */

export async function listSystems(includeInactive = false): Promise<System[]> {
  const all = await db.systems.toArray();
  const filtered = includeInactive ? all : all.filter((s) => s.active);
  return filtered.sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

export async function getSystem(id: string): Promise<System | undefined> {
  return db.systems.get(id);
}

export async function createSystem(name: string): Promise<System> {
  const s: System = {
    id: newId(),
    name: name.trim(),
    active: true,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.systems.add(s);
  return s;
}

export async function updateSystem(
  id: string,
  patch: Partial<Pick<System, 'name' | 'active'>>
): Promise<void> {
  const clean: Partial<System> = { updated_at: nowIso() };
  if (patch.name !== undefined) clean.name = patch.name.trim();
  if (patch.active !== undefined) clean.active = patch.active;
  await db.systems.update(id, clean);
}

export async function setSystemActive(id: string, active: boolean): Promise<void> {
  await db.systems.update(id, { active, updated_at: nowIso() });
}

export async function countTemplatesInSystem(systemId: string): Promise<number> {
  return db.templates.where('system_id').equals(systemId).count();
}

/**
 * Ensure at least one system exists and return a usable system id. Used when a
 * template is created without an explicit system, and by the seed.
 */
export async function ensureDefaultSystem(): Promise<string> {
  const all = await db.systems.toArray();
  const active = all.find((s) => s.active) ?? all[0];
  if (active) return active.id;
  const created = await createSystem('מערכת ראשית');
  return created.id;
}
