import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, ensureRoles, makeUser } from '@/test/helpers';
import { db } from '@/data/db';
import { nowIso } from '@/services/ids';
import { todayStr, addMonths } from '@/services/dates';
import { RoleName, type ExamAttempt, type UserSystemRank, type UserWithRoles } from '@/types';
import {
  onAttemptSubmitted, addApprover, canApprove, listPendingRenewals, approveRenewal, rejectRenewal, listRenewalsForUser,
} from '@/services/certRenewals';
import { getCertRow } from '@/services/certifications';

const S = 'sysX';
const R = 'rankB';

async function seedCert(userId: string, expiresIn = 2): Promise<UserSystemRank> {
  const now = nowIso();
  const issued = addMonths(todayStr(), -(12 - expiresIn)); // expires `expiresIn` months out
  const row: UserSystemRank = {
    id: 'cert1', user_id: userId, system_id: S, max_rank_id: R,
    issued_at: issued, validity_months: 12, expires_at: addMonths(issued, 12), created_at: now, updated_at: now,
  };
  await db.user_system_ranks.add(row);
  await db.systems.add({ id: S, name: 'מערכת X', active: true, sort_order: 0, created_at: now, updated_at: now } as never);
  await db.ranks.add({ id: R, name: 'דרג ב׳', active: true, sort_order: 1, created_at: now, updated_at: now } as never);
  return row;
}

function renewalAttempt(user: UserWithRoles, cert: UserSystemRank, passed: boolean, score: number, id = 'att1'): ExamAttempt {
  const now = nowIso();
  return {
    id, exam_id: 'exR', exam_version: '1.0', exam_title: 'מבחן רענון', exam_snapshot: [],
    purpose: 'renewal', cert_id: cert.id, cert_system_id: S, cert_rank_id: R,
    user_id: user.id, user_name: user.full_name, device_id: 'dev1',
    status: 'graded', answers: [], score, passed, started_at: now, updated_at: now, submitted_at: now,
  };
}

describe('certification renewal flow', () => {
  let user: UserWithRoles;
  let approver: UserWithRoles;
  let cert: UserSystemRank;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    user = await makeUser('isr', 'ישראל', [RoleName.PERFORMER]);
    approver = await makeUser('cmd', 'מפקד א׳', [RoleName.APPROVER]);
    cert = await seedCert(user.id);
  });

  it('pass creates ONE pending renewal; fail creates none; idempotent per attempt', async () => {
    await onAttemptSubmitted(renewalAttempt(user, cert, false, 70, 'fa'));
    expect(await listRenewalsForUser(user.id)).toHaveLength(0);

    await onAttemptSubmitted(renewalAttempt(user, cert, true, 91, 'a1'));
    let list = await listRenewalsForUser(user.id);
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('pending_approval');
    expect(list[0].score).toBe(91);
    expect(list[0].prev_expires_at).toBe(cert.expires_at);

    // Same attempt again → no duplicate.
    await onAttemptSubmitted(renewalAttempt(user, cert, true, 91, 'a1'));
    expect(await listRenewalsForUser(user.id)).toHaveLength(1);

    // A second passing attempt → still ONE pending (replaced), new score.
    await onAttemptSubmitted(renewalAttempt(user, cert, true, 95, 'a2'));
    list = await listRenewalsForUser(user.id);
    expect(list.filter((r) => r.status === 'pending_approval')).toHaveLength(1);
    expect(list.find((r) => r.status === 'pending_approval')!.score).toBe(95);
  });

  it('approval authority: assigned approver yes; self no; unassigned no', async () => {
    await onAttemptSubmitted(renewalAttempt(user, cert, true, 91));
    const r = (await listRenewalsForUser(user.id))[0];
    await addApprover({ user_id: approver.id, system_id: S });
    expect(await canApprove(approver, r)).toBe(true);
    expect(await canApprove(user, r)).toBe(false); // self-approval blocked
    const other = await makeUser('x', 'אחר', [RoleName.APPROVER]);
    expect(await canApprove(other, r)).toBe(false); // not assigned
  });

  it('approve renews the certification (expiry extended) and records approver + signature', async () => {
    await onAttemptSubmitted(renewalAttempt(user, cert, true, 91));
    const r = (await listRenewalsForUser(user.id))[0];
    await addApprover({ user_id: approver.id, system_id: S });

    const before = await getCertRow(user.id, S);
    const approved = await approveRenewal(r.id, approver, 'data:image/png;base64,SIG', 'מפקד');
    expect(approved.status).toBe('approved');
    expect(approved.approver_signature).toBe('data:image/png;base64,SIG');
    expect(approved.approved_by_name).toBe('מפקד א׳');

    const after = await getCertRow(user.id, S);
    expect(after!.expires_at).toBe(addMonths(todayStr(), 12)); // renewed from today + validity
    expect(after!.expires_at).not.toBe(before!.expires_at);
    expect(approved.new_expires_at).toBe(after!.expires_at);
  });

  it('unauthorized approver is rejected; revoked certification cannot be renewed', async () => {
    await onAttemptSubmitted(renewalAttempt(user, cert, true, 91));
    const r = (await listRenewalsForUser(user.id))[0];
    await expect(approveRenewal(r.id, approver, null)).rejects.toThrow(/מורשה/); // not assigned yet

    await addApprover({ user_id: approver.id, system_id: S });
    await db.user_system_ranks.delete(cert.id); // revoked
    await expect(approveRenewal(r.id, approver, null)).rejects.toThrow(/בוטלה|קיימת/);
  });

  it('reject sets status rejected and does not change the certification', async () => {
    await onAttemptSubmitted(renewalAttempt(user, cert, true, 91));
    const r = (await listRenewalsForUser(user.id))[0];
    await addApprover({ user_id: approver.id, system_id: S });
    const before = await getCertRow(user.id, S);
    const rej = await rejectRenewal(r.id, approver, 'לא עמד בדרישות');
    expect(rej.status).toBe('rejected');
    const after = await getCertRow(user.id, S);
    expect(after!.expires_at).toBe(before!.expires_at); // unchanged
  });

  it('approver queue is scoped to authorized renewals only', async () => {
    await onAttemptSubmitted(renewalAttempt(user, cert, true, 91));
    expect(await listPendingRenewals(approver)).toHaveLength(0); // not assigned
    await addApprover({ user_id: approver.id, system_id: S });
    expect(await listPendingRenewals(approver)).toHaveLength(1);
  });
});
