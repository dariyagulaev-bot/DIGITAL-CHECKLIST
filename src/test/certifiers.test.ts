import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db';
import { newId } from '@/services/ids';
import {
  canCertify,
  assertCanCertify,
  certifierScope,
  scopeAllows,
  setCertifierAuthorizations,
  listCertifierAuthorizations,
  NOT_AUTHORIZED_TO_CERTIFY,
} from '@/services/certifiers';
import { resetDb, ensureRoles, makeUser } from '@/test/helpers';
import { RoleName } from '@/types';

const SYS_A = 'sys-a';
const SYS_B = 'sys-b';
const RANK_1 = 'rank-1';
const RANK_2 = 'rank-2';

const actor = { id: 'admin-1', full_name: 'מנהל' };

describe('certifier authorizations', () => {
  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
  });

  it('CERTIFIER role alone grants nothing without an explicit authorization', async () => {
    const u = await makeUser('cert1', 'מסמיך א', [RoleName.CERTIFIER]);
    expect(await canCertify(u, SYS_A, RANK_1)).toBe(false);
    await expect(assertCanCertify(u, SYS_A, RANK_1)).rejects.toThrow(NOT_AUTHORIZED_TO_CERTIFY);
  });

  it('authorization is scoped to the exact (system, rank)', async () => {
    const u = await makeUser('cert2', 'מסמיך ב', [RoleName.CERTIFIER]);
    await setCertifierAuthorizations(u.id, [{ system_id: SYS_A, rank_id: RANK_1 }], actor);
    expect(await canCertify(u, SYS_A, RANK_1)).toBe(true);
    // Same system, different rank → not allowed.
    expect(await canCertify(u, SYS_A, RANK_2)).toBe(false);
    // Different system, same rank → not allowed.
    expect(await canCertify(u, SYS_B, RANK_1)).toBe(false);
  });

  it('ADMIN does NOT bypass certifier authorization', async () => {
    const admin = await makeUser('admin2', 'מנהל', [RoleName.ADMIN]);
    expect(await canCertify(admin, SYS_A, RANK_1)).toBe(false);
    // Even with an authorization row, without the CERTIFIER role it is denied.
    await setCertifierAuthorizations(admin.id, [{ system_id: SYS_A, rank_id: RANK_1 }], actor);
    expect(await canCertify(admin, SYS_A, RANK_1)).toBe(false);
  });

  it('APPROVER is not implicitly a certifier', async () => {
    const appr = await makeUser('appr1', 'מאשר', [RoleName.APPROVER]);
    await setCertifierAuthorizations(appr.id, [{ system_id: SYS_A, rank_id: RANK_1 }], actor);
    expect(await canCertify(appr, SYS_A, RANK_1)).toBe(false);
  });

  it('a user holding both CERTIFIER and ADMIN can certify in granted scope', async () => {
    const u = await makeUser('both1', 'מסמיך מנהל', [RoleName.ADMIN, RoleName.CERTIFIER]);
    await setCertifierAuthorizations(u.id, [{ system_id: SYS_B, rank_id: RANK_2 }], actor);
    expect(await canCertify(u, SYS_B, RANK_2)).toBe(true);
    expect(await canCertify(u, SYS_A, RANK_1)).toBe(false);
  });

  it('null user is denied', async () => {
    expect(await canCertify(null, SYS_A, RANK_1)).toBe(false);
  });

  it('setCertifierAuthorizations replaces the whole set and de-duplicates', async () => {
    const u = await makeUser('cert3', 'מסמיך ג', [RoleName.CERTIFIER]);
    await setCertifierAuthorizations(
      u.id,
      [
        { system_id: SYS_A, rank_id: RANK_1 },
        { system_id: SYS_A, rank_id: RANK_1 }, // duplicate
        { system_id: SYS_A, rank_id: RANK_2 },
      ],
      actor
    );
    let rows = await listCertifierAuthorizations(u.id);
    expect(rows).toHaveLength(2);
    // Replace with a smaller set.
    await setCertifierAuthorizations(u.id, [{ system_id: SYS_B, rank_id: RANK_1 }], actor);
    rows = await listCertifierAuthorizations(u.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].system_id).toBe(SYS_B);
    // Clearing removes everything.
    await setCertifierAuthorizations(u.id, [], actor);
    expect(await listCertifierAuthorizations(u.id)).toHaveLength(0);
  });

  it('certifierScope + scopeAllows reflect stored authorizations', async () => {
    const u = await makeUser('cert4', 'מסמיך ד', [RoleName.CERTIFIER]);
    await setCertifierAuthorizations(
      u.id,
      [
        { system_id: SYS_A, rank_id: RANK_1 },
        { system_id: SYS_A, rank_id: RANK_2 },
      ],
      actor
    );
    const scope = await certifierScope(u.id);
    expect(scopeAllows(scope, SYS_A, RANK_1)).toBe(true);
    expect(scopeAllows(scope, SYS_A, RANK_2)).toBe(true);
    expect(scopeAllows(scope, SYS_B, RANK_1)).toBe(false);
  });

  it('removing authorizations is audited (CERTIFIER_AUTH_CHANGE)', async () => {
    const u = await makeUser('cert5', 'מסמיך ה', [RoleName.CERTIFIER]);
    await setCertifierAuthorizations(u.id, [{ system_id: SYS_A, rank_id: RANK_1 }], actor);
    await setCertifierAuthorizations(u.id, [], actor);
    const logs = (await db.audit_log.toArray()).filter((l) => l.action === 'CERTIFIER_AUTH_CHANGE');
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.every((l) => l.entity_id === u.id)).toBe(true);
  });

  it('no-op write (same scope) is not re-audited', async () => {
    const u = await makeUser('cert6', 'מסמיך ו', [RoleName.CERTIFIER]);
    await setCertifierAuthorizations(u.id, [{ system_id: SYS_A, rank_id: RANK_1 }], actor);
    const count = async () =>
      (await db.audit_log.toArray()).filter((l) => l.action === 'CERTIFIER_AUTH_CHANGE').length;
    const before = await count();
    await setCertifierAuthorizations(u.id, [{ system_id: SYS_A, rank_id: RANK_1 }], actor);
    const after = await count();
    expect(after).toBe(before);
    // Suppress unused import lint for newId (kept for parity with other suites).
    void newId;
  });
});
