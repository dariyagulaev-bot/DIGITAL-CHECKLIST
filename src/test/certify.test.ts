import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db';
import { resetDb, ensureRoles, makeUser } from '@/test/helpers';
import { createSystem } from '@/services/systems';
import { createRank } from '@/services/ranks';
import { setCertifierAuthorizations, NOT_AUTHORIZED_TO_CERTIFY } from '@/services/certifiers';
import { addPrerequisite } from '@/services/prerequisites';
import {
  performCertification,
  getRankCertification,
  missingPrerequisites,
  PREREQ_NOT_MET,
  CERTIFIER_NOT_COMPETENT,
} from '@/services/certify';
import { effectiveRankStatus } from '@/services/competency';
import { isUserCertified } from '@/services/certifications';
import { setCertifierRequireOwnCompetency } from '@/services/settings';
import { RoleName, type UserWithRoles } from '@/types';

let certifier: UserWithRoles;
let employee: UserWithRoles;
let sysId: string;
let rankA: string;
let rankB: string;

async function setup() {
  await resetDb();
  await ensureRoles();
  sysId = (await createSystem('מערכת א׳')).id;
  rankA = (await createRank('דרג א׳')).id;
  rankB = (await createRank('דרג ב׳')).id;
  certifier = await makeUser('cert', 'מסמיך', [RoleName.CERTIFIER]);
  employee = await makeUser('emp', 'עובד', [RoleName.PERFORMER]);
}

const actor = () => ({ id: certifier.id, full_name: certifier.full_name });

describe('certification workflow', () => {
  beforeEach(setup);

  it('refuses when the certifier is not authorized for (system, rank)', async () => {
    await expect(
      performCertification({
        employeeUserId: employee.id,
        systemId: sysId,
        rankId: rankA,
        actionType: 'initial',
        certifier,
      })
    ).rejects.toThrow(NOT_AUTHORIZED_TO_CERTIFY);
  });

  it('performs an initial certification once authorized, and VERO sees it', async () => {
    await setCertifierAuthorizations(certifier.id, [{ system_id: sysId, rank_id: rankA }], actor());
    const { rankCertification } = await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankA,
      actionType: 'initial',
      certifier,
      signatureData: 'data:image/png;base64,AAAA',
    });
    expect(rankCertification.certifier_user_id).toBe(certifier.id);
    expect(rankCertification.certifier_name_snapshot).toBe('מסמיך');
    expect(rankCertification.signature_data).toBeTruthy();
    expect(await effectiveRankStatus(employee.id, sysId, rankA)).toBe('valid');
    // Legacy projection updated → VERO gating sees the employee certified.
    expect(await isUserCertified(employee.id, sysId, rankA)).toBe(true);
  });

  it('blocks a higher rank until the prerequisite is held, then allows it', async () => {
    // B requires A.
    await addPrerequisite(sysId, rankB, rankA, { id: 'admin', full_name: 'מנהל' });
    await setCertifierAuthorizations(
      certifier.id,
      [
        { system_id: sysId, rank_id: rankA },
        { system_id: sysId, rank_id: rankB },
      ],
      actor()
    );
    // Employee has no A yet → certifying B is blocked.
    expect(await missingPrerequisites(employee.id, sysId, rankB)).toEqual([rankA]);
    await expect(
      performCertification({
        employeeUserId: employee.id,
        systemId: sysId,
        rankId: rankB,
        actionType: 'initial',
        certifier,
      })
    ).rejects.toThrow(PREREQ_NOT_MET);
    // Certify A first, then B succeeds.
    await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankA,
      actionType: 'initial',
      certifier,
    });
    expect(await missingPrerequisites(employee.id, sysId, rankB)).toEqual([]);
    await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankB,
      actionType: 'initial',
      certifier,
    });
    expect(await effectiveRankStatus(employee.id, sysId, rankB)).toBe('valid');
  });

  it('when a prerequisite later expires, the higher rank goes inactive and VERO blocks it', async () => {
    await addPrerequisite(sysId, rankB, rankA, { id: 'admin', full_name: 'מנהל' });
    await setCertifierAuthorizations(
      certifier.id,
      [
        { system_id: sysId, rank_id: rankA },
        { system_id: sysId, rank_id: rankB },
      ],
      actor()
    );
    // A certified but already expired (issued far in the past, 1-month validity).
    await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankA,
      actionType: 'initial',
      certifier,
      issuedAt: '2020-01-01',
      validityMonths: 1,
    });
    // B still "valid" by its own dates but A is expired → B inactive_prereq.
    await db.rank_certifications.add({
      id: 'manual-b',
      user_id: employee.id,
      system_id: sysId,
      rank_id: rankB,
      action_type: 'initial',
      issued_at: '2026-01-01',
      validity_months: 24,
      expires_at: '2028-01-01',
      certifier_user_id: certifier.id,
      certifier_name_snapshot: 'מסמיך',
      created_at: '',
      updated_at: '',
    });
    expect(await effectiveRankStatus(employee.id, sysId, rankB)).toBe('inactive_prereq');
    expect(await isUserCertified(employee.id, sysId, rankB)).toBe(false);
  });

  it('§15: enforces the certifier-own-competency policy when enabled', async () => {
    await setCertifierRequireOwnCompetency(true);
    await setCertifierAuthorizations(certifier.id, [{ system_id: sysId, rank_id: rankA }], actor());
    // Certifier is not certified themselves → blocked.
    await expect(
      performCertification({
        employeeUserId: employee.id,
        systemId: sysId,
        rankId: rankA,
        actionType: 'initial',
        certifier,
      })
    ).rejects.toThrow(CERTIFIER_NOT_COMPETENT);
    // Give the certifier their own active grant → now allowed.
    await db.rank_certifications.add({
      id: 'cert-self-a',
      user_id: certifier.id,
      system_id: sysId,
      rank_id: rankA,
      action_type: 'initial',
      issued_at: '2026-01-01',
      validity_months: 24,
      expires_at: '2099-01-01',
      certifier_user_id: certifier.id,
      certifier_name_snapshot: 'מסמיך',
      created_at: '',
      updated_at: '',
    });
    await expect(
      performCertification({
        employeeUserId: employee.id,
        systemId: sysId,
        rankId: rankA,
        actionType: 'initial',
        certifier,
      })
    ).resolves.toBeTruthy();
  });

  it('a renewal updates the existing grant and is audited as a renewal', async () => {
    await setCertifierAuthorizations(certifier.id, [{ system_id: sysId, rank_id: rankA }], actor());
    await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankA,
      actionType: 'initial',
      certifier,
      issuedAt: '2025-01-01',
    });
    await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankA,
      actionType: 'renewal',
      certifier,
      issuedAt: '2026-01-01',
    });
    const grant = await getRankCertification(employee.id, sysId, rankA);
    expect(grant?.action_type).toBe('renewal');
    expect(grant?.issued_at).toBe('2026-01-01');
    // Exactly one grant row (upsert, not duplicate).
    const all = await db.rank_certifications
      .where('[user_id+system_id+rank_id]')
      .equals([employee.id, sysId, rankA])
      .toArray();
    expect(all).toHaveLength(1);
    const logs = (await db.audit_log.toArray()).filter((l) => l.action === 'CERT_RENEW_PERFORM');
    expect(logs.length).toBe(1);
  });

  it('does not write the employee full id number into the audit log', async () => {
    // Give the employee a protected id number.
    await db.users.update(employee.id, { id_type: 'national', id_number: '123456782' });
    await setCertifierAuthorizations(certifier.id, [{ system_id: sysId, rank_id: rankA }], actor());
    await performCertification({
      employeeUserId: employee.id,
      systemId: sysId,
      rankId: rankA,
      actionType: 'initial',
      certifier,
    });
    const logs = await db.audit_log.toArray();
    const blob = JSON.stringify(logs);
    expect(blob).not.toContain('123456782'); // full number never stored
    expect(blob).toContain('6782'); // only the masked last-4 reference
  });
});
