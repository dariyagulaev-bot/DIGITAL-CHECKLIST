import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db';
import { resetDb, ensureRoles, makeUser } from '@/test/helpers';
import { createSystem } from '@/services/systems';
import { createRank } from '@/services/ranks';
import { updateUserProfile, listUsersWithRoles } from '@/services/auth';
import { setCertifierAuthorizations, canCertify } from '@/services/certifiers';
import { addPrerequisite } from '@/services/prerequisites';
import { performCertification, PREREQ_NOT_MET } from '@/services/certify';
import { issueCertificate, getCertificate, saveCertificateTemplate, getCertificateTemplate } from '@/services/certificates';
import { isUserCertified, listCertifiedPerformerUsers } from '@/services/certifications';
import { effectiveRankStatus } from '@/services/competency';
import { exportFullBackup, restoreFullBackup } from '@/services/backup';
import { NOT_AUTHORIZED_TO_CERTIFY } from '@/services/certifiers';
import { RoleName, type UserWithRoles } from '@/types';

/**
 * End-to-end certification lifecycle (spec §29 scenarios), driven through the
 * SAME service entry points the UI calls. Covers: protected identity, certifier
 * authorization (incl. ADMIN/APPROVER non-bypass), prerequisite chain with
 * expiry/recovery, VERO effective gating, certificate issuance + immutable
 * reprint, authorization removal not touching the past, and full backup.
 */

let adminUser: UserWithRoles;
let certifier: UserWithRoles;
let approver: UserWithRoles;
let employee: UserWithRoles;
let sysId: string;
let rankA: string;
let rankB: string;

const adminActor = () => ({ id: adminUser.id, full_name: adminUser.full_name });

async function reload(u: UserWithRoles): Promise<UserWithRoles> {
  return (await listUsersWithRoles()).find((x) => x.id === u.id)!;
}

beforeEach(async () => {
  await resetDb();
  await ensureRoles();
  sysId = (await createSystem('מערכת א׳')).id;
  rankA = (await createRank('דרג א׳')).id;
  rankB = (await createRank('דרג ב׳')).id;
  adminUser = await makeUser('admin', 'מנהל', [RoleName.ADMIN]);
  certifier = await makeUser('cert', 'מסמיך', [RoleName.CERTIFIER]);
  approver = await makeUser('appr', 'מאשר', [RoleName.APPROVER]);
  employee = await makeUser('emp', 'ישראל ישראלי', [RoleName.PERFORMER]);
});

describe('certification lifecycle (E2E)', () => {
  it('full happy path: identity → authorize → certify → certificate → VERO → reprint', async () => {
    // Admin records the employee's protected identity (never a login).
    await updateUserProfile(employee.id, { id_type: 'national', id_number: '123456782' });
    const emp = await reload(employee);
    expect(emp.username).toBe('emp'); // identity did NOT change the username
    expect(emp.id_number).toBe('123456782');

    // Admin authorizes the certifier for (system, rank A).
    await setCertifierAuthorizations(certifier.id, [{ system_id: sysId, rank_id: rankA }], adminActor());
    expect(await canCertify(certifier, sysId, rankA)).toBe(true);

    // Certifier performs the initial certification + issues a certificate.
    const { rankCertification } = await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankA,
      actionType: 'initial',
      certifier,
      signatureData: 'data:image/png;base64,SIG',
      certificateIssued: true,
    });
    const cert = await issueCertificate({
      rankCertification,
      userName: emp.full_name,
      systemName: 'מערכת א׳',
      rankName: 'דרג א׳',
      certifier,
      idType: emp.id_type,
      idNumber: emp.id_number,
    });
    expect(cert.number).toMatch(/^VERO-CERT-\d{6}$/);

    // VERO now treats the employee as certified for (system, rank A).
    expect(await isUserCertified(employee.id, sysId, rankA)).toBe(true);
    const pool = await listCertifiedPerformerUsers(sysId, rankA);
    expect(pool.some((p) => p.id === employee.id)).toBe(true);

    // Reprint uses the frozen snapshot even after the template changes.
    const tmpl = await getCertificateTemplate('initial');
    await saveCertificateTemplate('initial', { ...tmpl, title: 'שונה' }, adminActor());
    const reprinted = await getCertificate(cert.id);
    expect((reprinted?.design_snapshot as { title?: string }).title).not.toBe('שונה');
  });

  it('ADMIN and APPROVER cannot certify without an explicit certifier authorization', async () => {
    expect(await canCertify(adminUser, sysId, rankA)).toBe(false);
    expect(await canCertify(approver, sysId, rankA)).toBe(false);
    await expect(
      performCertification({
        employeeUserId: employee.id,
        systemId: sysId,
        rankId: rankA,
        actionType: 'initial',
        certifier: adminUser,
      })
    ).rejects.toThrow(NOT_AUTHORIZED_TO_CERTIFY);
  });

  it('prerequisite chain: block, allow, lapse → inactive, renew → recover', async () => {
    await addPrerequisite(sysId, rankB, rankA, adminActor());
    await setCertifierAuthorizations(
      certifier.id,
      [
        { system_id: sysId, rank_id: rankA },
        { system_id: sysId, rank_id: rankB },
      ],
      adminActor()
    );

    // Cannot certify B before A.
    await expect(
      performCertification({
        employeeUserId: employee.id,
        systemId: sysId,
        rankId: rankB,
        actionType: 'initial',
        certifier,
      })
    ).rejects.toThrow(PREREQ_NOT_MET);

    // Certify A (expired on purpose) then B.
    await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankA,
      actionType: 'initial',
      certifier,
      issuedAt: '2020-01-01',
      validityMonths: 1,
    });
    // A is expired now, so B is still blocked as a prerequisite.
    expect(await missingThrows(rankB)).toBe(true);

    // Give A a long validity (renew) → now B can be certified.
    await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankA,
      actionType: 'renewal',
      certifier,
      issuedAt: '2026-01-01',
      validityMonths: 120,
    });
    await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankB,
      actionType: 'initial',
      certifier,
      issuedAt: '2026-01-01',
      validityMonths: 120,
    });
    expect(await effectiveRankStatus(employee.id, sysId, rankB)).toBe('valid');
    expect(await isUserCertified(employee.id, sysId, rankB)).toBe(true);

    // Expire A again by editing its grant → B goes inactive, VERO blocks B.
    const aGrant = await db.rank_certifications
      .where('[user_id+system_id+rank_id]')
      .equals([employee.id, sysId, rankA])
      .first();
    await db.rank_certifications.update(aGrant!.id, { expires_at: '2020-01-01' });
    expect(await effectiveRankStatus(employee.id, sysId, rankB)).toBe('inactive_prereq');
    expect(await isUserCertified(employee.id, sysId, rankB)).toBe(false);
  });

  it('removing certifier authorization does not affect past certifications or certificates', async () => {
    await setCertifierAuthorizations(certifier.id, [{ system_id: sysId, rank_id: rankA }], adminActor());
    const { rankCertification } = await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankA,
      actionType: 'initial',
      certifier,
    });
    const cert = await issueCertificate({
      rankCertification,
      userName: employee.full_name,
      systemName: 'מערכת א׳',
      rankName: 'דרג א׳',
      certifier,
    });
    // Revoke the certifier's authorization entirely.
    await setCertifierAuthorizations(certifier.id, [], adminActor());
    expect(await canCertify(certifier, sysId, rankA)).toBe(false);
    // The employee stays certified; the issued certificate still exists.
    expect(await isUserCertified(employee.id, sysId, rankA)).toBe(true);
    expect(await getCertificate(cert.id)).toBeTruthy();
  });

  it('identity is never written in full to the audit log', async () => {
    await updateUserProfile(employee.id, { id_type: 'national', id_number: '123456782' });
    await setCertifierAuthorizations(certifier.id, [{ system_id: sysId, rank_id: rankA }], adminActor());
    const emp = await reload(employee);
    await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankA,
      actionType: 'initial',
      certifier,
    });
    const blob = JSON.stringify(await db.audit_log.toArray());
    expect(blob).not.toContain('123456782');
    expect(emp.id_number).toBe('123456782'); // still stored on the user record itself
  });

  it('full backup round-trips the new certification tables', async () => {
    await setCertifierAuthorizations(certifier.id, [{ system_id: sysId, rank_id: rankA }], adminActor());
    await addPrerequisite(sysId, rankB, rankA, adminActor());
    const { rankCertification } = await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankA,
      actionType: 'initial',
      certifier,
    });
    await issueCertificate({
      rankCertification,
      userName: employee.full_name,
      systemName: 'מערכת א׳',
      rankName: 'דרג א׳',
      certifier,
    });

    const backup = await exportFullBackup();
    await restoreFullBackup(backup, adminUser);

    expect(await db.certifier_authorizations.count()).toBe(1);
    expect(await db.rank_certifications.count()).toBe(1);
    expect(await db.system_rank_prerequisites.count()).toBe(1);
    expect(await db.certificates.count()).toBe(1);
  });
});

/** Helper: did certifying rankB throw PREREQ_NOT_MET? */
async function missingThrows(rankId: string): Promise<boolean> {
  try {
    await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId,
      actionType: 'initial',
      certifier,
    });
    return false;
  } catch (e) {
    return (e as Error).message === PREREQ_NOT_MET;
  }
}
