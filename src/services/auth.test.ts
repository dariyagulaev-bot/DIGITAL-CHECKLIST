import { beforeEach, describe, expect, it } from 'vitest';
import { login, hashPassword, verifyPassword, setUserActive } from './auth';
import { RoleName } from '@/types';
import { ensureRoles, makeUser, resetDb } from '@/test/helpers';

describe('authentication', () => {
  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
  });

  it('hashes passwords (never stores plaintext)', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toContain('secret123');
    expect(await verifyPassword('secret123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('logs in with correct credentials and resolves roles', async () => {
    await makeUser('dana', 'דנה כהן', [RoleName.APPROVER], 'pass1');
    const u = await login('dana', 'pass1');
    expect(u).not.toBeNull();
    expect(u!.full_name).toBe('דנה כהן');
    expect(u!.roles).toContain(RoleName.APPROVER);
  });

  it('rejects wrong password', async () => {
    await makeUser('dana', 'דנה', [RoleName.PERFORMER], 'pass1');
    expect(await login('dana', 'nope')).toBeNull();
  });

  it('rejects inactive users', async () => {
    const u = await makeUser('bob', 'בוב', [RoleName.PERFORMER], 'pass1');
    await setUserActive(u.id, false);
    expect(await login('bob', 'pass1')).toBeNull();
  });

  it('is case-insensitive on username', async () => {
    await makeUser('mixed', 'משתמש', [RoleName.PERFORMER], 'pass1');
    expect(await login('MIXED', 'pass1')).not.toBeNull();
  });
});
