import { db } from '@/data/db';
import { newId } from '@/services/ids';
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
