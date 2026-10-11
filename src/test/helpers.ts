import { db } from '@/data/db';
import { newId, nowIso } from '@/services/ids';
import { createUser } from '@/services/auth';
import { RoleName, type UserWithRoles } from '@/types';
import { withRoles } from '@/services/auth';

/** Clear every table so each test starts from a clean database. */
export async function resetDb(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}

/** Ensure the three system roles exist. */
export async function ensureRoles(): Promise<void> {
  const existing = await db.roles.toArray();
  const names = new Set(existing.map((r) => r.name));
  for (const name of [RoleName.PERFORMER, RoleName.APPROVER, RoleName.ADMIN]) {
    if (!names.has(name)) await db.roles.add({ id: newId(), name });
  }
}

/** Create a user with roles and return it resolved with role names. */
export async function makeUser(
  username: string,
  fullName: string,
  roles: RoleName[],
  password = 'pw1234'
): Promise<UserWithRoles> {
  const u = await createUser({ username, full_name: fullName, password, roles });
  return withRoles(u);
}

/**
 * Grant a user a top-rank certification for every system currently in the DB
 * (mirrors the production v9 migration). Call after systems/ranks exist so a
 * performer can create forms under the new certification gating.
 */
export async function certifyAllSystems(userId: string): Promise<void> {
  const systems = await db.systems.toArray();
  const ranks = (await db.ranks.toArray()).sort((a, b) => a.sort_order - b.sort_order);
  if (!ranks.length) return;
  const top = ranks[ranks.length - 1].id;
  for (const s of systems) {
    const exists = await db.user_system_ranks
      .where('[user_id+system_id]')
      .equals([userId, s.id])
      .first();
    if (!exists) {
      await db.user_system_ranks.add({
        id: newId(),
        user_id: userId,
        system_id: s.id,
        max_rank_id: top,
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    }
  }
}
