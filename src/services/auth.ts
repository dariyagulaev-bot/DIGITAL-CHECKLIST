import bcrypt from 'bcryptjs';
import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import { RoleName, type User, type UserWithRoles } from '@/types';

const SALT_ROUNDS = 10;

/** Hash a plaintext password. Passwords are never stored in plaintext. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/** Resolve the role names held by a user. */
export async function getUserRoles(userId: string): Promise<RoleName[]> {
  const links = await db.user_roles.where('user_id').equals(userId).toArray();
  const roleIds = links.map((l) => l.role_id);
  const roles = await db.roles.bulkGet(roleIds);
  return roles.filter((r): r is NonNullable<typeof r> => !!r).map((r) => r.name);
}

export async function withRoles(user: User): Promise<UserWithRoles> {
  const roles = await getUserRoles(user.id);
  return { ...user, roles };
}

/**
 * Authenticate by username + password.
 * Returns the user (with roles) on success, or null on failure.
 * Inactive users are rejected.
 */
export async function login(username: string, password: string): Promise<UserWithRoles | null> {
  const uname = username.trim().toLowerCase();
  const user = await db.users.where('username').equals(uname).first();
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return null;
  return withRoles(user);
}

/** List active users (for the login screen picker). */
export async function listActiveUsers(): Promise<User[]> {
  const all = await db.users.toArray();
  return all.filter((u) => u.active).sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'));
}

/** Create a user with the given roles. Returns the created user. */
export async function createUser(params: {
  username: string;
  full_name: string;
  password: string;
  roles: RoleName[];
  active?: boolean;
}): Promise<User> {
  const uname = params.username.trim().toLowerCase();
  const existing = await db.users.where('username').equals(uname).first();
  if (existing) throw new Error('שם המשתמש כבר קיים במערכת');
  const user: User = {
    id: newId(),
    username: uname,
    full_name: params.full_name.trim(),
    password_hash: await hashPassword(params.password),
    active: params.active ?? true,
    created_at: nowIso(),
  };
  await db.users.add(user);
  await setUserRoles(user.id, params.roles);
  return user;
}

/** Replace the set of roles for a user. */
export async function setUserRoles(userId: string, roles: RoleName[]): Promise<void> {
  const existing = await db.user_roles.where('user_id').equals(userId).toArray();
  await db.user_roles.bulkDelete(existing.map((e) => e.id));
  const allRoles = await db.roles.toArray();
  const byName = new Map(allRoles.map((r) => [r.name, r.id]));
  const links = roles
    .filter((r) => byName.has(r))
    .map((r) => ({ id: newId(), user_id: userId, role_id: byName.get(r)! }));
  if (links.length) await db.user_roles.bulkAdd(links);
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  await db.users.update(userId, { active });
}

export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  await db.users.update(userId, { password_hash: await hashPassword(newPassword) });
}

export async function updateUserProfile(
  userId: string,
  patch: Partial<Pick<User, 'full_name' | 'username'>>
): Promise<void> {
  const clean: Partial<User> = {};
  if (patch.full_name !== undefined) clean.full_name = patch.full_name.trim();
  if (patch.username !== undefined) {
    const uname = patch.username.trim().toLowerCase();
    const existing = await db.users.where('username').equals(uname).first();
    if (existing && existing.id !== userId) throw new Error('שם המשתמש כבר קיים במערכת');
    clean.username = uname;
  }
  await db.users.update(userId, clean);
}

export async function listUsersWithRoles(): Promise<UserWithRoles[]> {
  const users = await db.users.toArray();
  return Promise.all(users.map(withRoles));
}

export async function getUserById(userId: string): Promise<User | undefined> {
  return db.users.get(userId);
}
