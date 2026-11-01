import { db } from '@/data/db';
import { newId, nowIso } from './ids';
import { logAudit } from './audit';
import { todayStr } from './dates';
import { getCertRow, renewCertification, certStatus } from './certifications';
import { startAttempt } from './exams';
import type {
  CertRenewal,
  Exam,
  ExamAttempt,
  RenewalApprover,
  UserSystemRank,
  UserWithRoles,
} from '@/types';

/**
 * Certification RENEWAL flow — built ON TOP of the existing certification +
 * 3-month-expiry mechanism and the existing exam module. It does not replace or
 * modify them.
 *
 * Flow: a certification nearing expiry (status 'needs_renewal') → the user takes
 * the matching RENEWAL exam independently → passing (≥80) creates a renewal
 * record in 'pending_approval' (it never renews the certification by itself) →
 * an authorized approver approves it with their signature → only THEN is the
 * certification's expiry extended (via the existing renewCertification), the
 * alert clears, and the status returns to valid. Every step is audited.
 */

// ===== matching a renewal exam to a certification ==========================

/** The published renewal exam for a system+rank (exact rank preferred, else the
 * system-wide renewal exam). */
export async function findRenewalExam(systemId: string, rankId: string | null): Promise<Exam | null> {
  const exams = (await db.exams.toArray()).filter((e) => e.exam_type === 'renewal' && e.published && e.system_id === systemId);
  if (!exams.length) return null;
  return exams.find((e) => e.rank_id === rankId) ?? exams.find((e) => !e.rank_id) ?? exams[0];
}

/** Does this certification currently have a usable renewal path (in window + an
 * exam exists)? Used to decide whether to show "בצע רענון". */
export async function renewalAvailable(cert: UserSystemRank): Promise<{ inWindow: boolean; exam: Exam | null }> {
  const status = certStatus(cert);
  const inWindow = status === 'needs_renewal' || status === 'expired';
  const exam = inWindow ? await findRenewalExam(cert.system_id, cert.max_rank_id) : null;
  return { inWindow, exam };
}

// ===== starting a renewal attempt ==========================================

export async function startRenewal(user: UserWithRoles, cert: UserSystemRank): Promise<string> {
  const exam = await findRenewalExam(cert.system_id, cert.max_rank_id);
  if (!exam) throw new Error('לא הוגדר מבחן רענון למערכת ולדרג של הסמכה זו.');
  const attemptId = await startAttempt(exam.id, user, {
    purpose: 'renewal',
    cert_id: cert.id,
    cert_system_id: cert.system_id,
    cert_rank_id: cert.max_rank_id,
  });
  await logAudit({ user_id: user.id, user_name: user.full_name, action: 'RENEWAL_START', entity_type: 'cert_renewal', entity_id: cert.id, field: cert.system_id, new_value: attemptId });
  return attemptId;
}

/**
 * Called by submitAttempt after a renewal attempt is scored. On PASS, create (or
 * replace) the single pending renewal for that certification. On FAIL, nothing
 * is created (the user may retake). Idempotent per attempt.
 */
export async function onAttemptSubmitted(attempt: ExamAttempt): Promise<void> {
  if (attempt.purpose !== 'renewal') return;
  // Already recorded for this attempt? (idempotent re-submit / late sync)
  const existingForAttempt = (await db.cert_renewals.where('attempt_id').equals(attempt.id).toArray())[0];
  if (existingForAttempt) return;

  if (attempt.passed !== true) {
    await logAudit({ user_id: attempt.user_id, user_name: attempt.user_name, action: 'RENEWAL_EXAM_FAILED', entity_type: 'cert_renewal', entity_id: attempt.cert_id ?? '-', field: attempt.cert_system_id ?? '', new_value: String(attempt.score ?? '') });
    return;
  }
  const cert = attempt.cert_id ? await db.user_system_ranks.get(attempt.cert_id) : null;
  const [system, rank] = await Promise.all([
    attempt.cert_system_id ? db.systems.get(attempt.cert_system_id) : undefined,
    attempt.cert_rank_id ? db.ranks.get(attempt.cert_rank_id) : undefined,
  ]);
  const now = nowIso();
  const base: CertRenewal = {
    id: newId(),
    user_id: attempt.user_id,
    user_name: attempt.user_name,
    system_id: attempt.cert_system_id ?? '',
    system_name: system?.name,
    rank_id: attempt.cert_rank_id ?? null,
    rank_name: rank?.name,
    cert_id: attempt.cert_id ?? '',
    exam_id: attempt.exam_id,
    exam_version: attempt.exam_version,
    attempt_id: attempt.id,
    score: attempt.score ?? 0,
    passed: true,
    status: 'pending_approval',
    prev_expires_at: cert?.expires_at ?? null,
    started_at: attempt.started_at,
    submitted_at: attempt.submitted_at ?? now,
    device_id: attempt.device_id,
    created_at: now,
    updated_at: now,
  };
  // Keep ONE pending renewal per certification: replace an existing pending one.
  const pendings = (await db.cert_renewals.where('cert_id').equals(base.cert_id).toArray()).filter((r) => r.status === 'pending_approval');
  if (pendings.length) {
    await db.cert_renewals.update(pendings[0].id, { ...base, id: pendings[0].id, created_at: pendings[0].created_at });
  } else {
    await db.cert_renewals.add(base);
  }
  await logAudit({ user_id: attempt.user_id, user_name: attempt.user_name, action: 'RENEWAL_SUBMITTED', entity_type: 'cert_renewal', entity_id: base.cert_id, field: base.system_id, new_value: `ציון ${base.score} · ממתין לאישור` });
}

// ===== approver assignments ================================================

export async function listApprovers(): Promise<RenewalApprover[]> {
  return db.renewal_approvers.toArray();
}
export async function addApprover(params: { user_id: string; user_name?: string; system_id?: string | null; rank_id?: string | null }): Promise<RenewalApprover> {
  const row: RenewalApprover = { id: newId(), user_id: params.user_id, user_name: params.user_name, system_id: params.system_id ?? null, rank_id: params.rank_id ?? null, created_at: nowIso() };
  await db.renewal_approvers.add(row);
  return row;
}
export async function removeApprover(id: string): Promise<void> {
  await db.renewal_approvers.delete(id);
}

/** Is this user allowed to approve this renewal? Admin status alone does NOT
 * grant it; an approver assignment matching the system/rank is required, and
 * self-approval is blocked. */
export async function canApprove(user: { id: string }, renewal: Pick<CertRenewal, 'user_id' | 'system_id' | 'rank_id'>): Promise<boolean> {
  if (user.id === renewal.user_id) return false; // no self-approval
  const rows = await db.renewal_approvers.where('user_id').equals(user.id).toArray();
  return rows.some((a) => (!a.system_id || a.system_id === renewal.system_id) && (!a.rank_id || a.rank_id === renewal.rank_id));
}

// ===== queues & views ======================================================

export async function listPendingRenewals(approver?: { id: string }): Promise<CertRenewal[]> {
  const rows = (await db.cert_renewals.where('status').equals('pending_approval').toArray()).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  if (!approver) return rows;
  const out: CertRenewal[] = [];
  for (const r of rows) if (await canApprove(approver, r)) out.push(r);
  return out;
}
export async function listRenewalsForUser(userId: string): Promise<CertRenewal[]> {
  return (await db.cert_renewals.where('user_id').equals(userId).toArray()).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
}
export async function getRenewal(id: string): Promise<CertRenewal | undefined> {
  return db.cert_renewals.get(id);
}
export async function listAllRenewals(): Promise<CertRenewal[]> {
  return (await db.cert_renewals.toArray()).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
}

// ===== approve / reject ====================================================

export async function approveRenewal(renewalId: string, approver: UserWithRoles, signatureDataUrl: string | null, role?: string): Promise<CertRenewal> {
  const r = await db.cert_renewals.get(renewalId);
  if (!r) throw new Error('רשומת הרענון לא נמצאה');
  if (r.status !== 'pending_approval') return r; // idempotent
  if (!(await canApprove(approver, r))) throw new Error('אינך מורשה לאשר רענון זה.');
  // The certification must still exist (not revoked) to be renewed.
  const cert = await getCertRow(r.user_id, r.system_id);
  if (!cert) throw new Error('ההסמכה בוטלה או אינה קיימת — לא ניתן לחדש.');

  const newIssued = todayStr();
  await renewCertification(r.user_id, r.system_id, newIssued, { id: approver.id, full_name: approver.full_name });
  const renewed = await getCertRow(r.user_id, r.system_id);
  const now = nowIso();
  const patch: Partial<CertRenewal> = {
    status: 'approved',
    approved_by_id: approver.id,
    approved_by_name: approver.full_name,
    approved_by_role: role ?? 'מאשר רענון',
    approver_signature: signatureDataUrl ?? null,
    approved_at: now,
    new_expires_at: renewed?.expires_at ?? null,
    updated_at: now,
  };
  await db.cert_renewals.update(renewalId, patch);
  await logAudit({ user_id: approver.id, user_name: approver.full_name, action: 'RENEWAL_APPROVED', entity_type: 'cert_renewal', entity_id: r.cert_id, field: r.system_id, old_value: r.prev_expires_at ?? '', new_value: renewed?.expires_at ?? '' });
  return { ...r, ...patch } as CertRenewal;
}

export async function rejectRenewal(renewalId: string, approver: UserWithRoles, reason: string): Promise<CertRenewal> {
  const r = await db.cert_renewals.get(renewalId);
  if (!r) throw new Error('רשומת הרענון לא נמצאה');
  if (r.status !== 'pending_approval') return r;
  if (!(await canApprove(approver, r))) throw new Error('אינך מורשה לטפל ברענון זה.');
  const now = nowIso();
  const patch: Partial<CertRenewal> = { status: 'rejected', approved_by_id: approver.id, approved_by_name: approver.full_name, reject_reason: reason, approved_at: now, updated_at: now };
  await db.cert_renewals.update(renewalId, patch);
  await logAudit({ user_id: approver.id, user_name: approver.full_name, action: 'RENEWAL_REJECTED', entity_type: 'cert_renewal', entity_id: r.cert_id, field: r.system_id, new_value: reason });
  return { ...r, ...patch } as CertRenewal;
}

// ===== dashboard ===========================================================

export interface RenewalDashboard {
  expired: number; // certifications past expiry
  expiring_no_renewal: number; // in renewal window, no pending/approved renewal
  pending_approval: number;
  approved_recent: number;
}
export async function renewalDashboard(): Promise<RenewalDashboard> {
  const [certs, renewals] = await Promise.all([db.user_system_ranks.toArray(), db.cert_renewals.toArray()]);
  const pendingByCert = new Set(renewals.filter((r) => r.status === 'pending_approval').map((r) => r.cert_id));
  let expired = 0;
  let expiringNoRenewal = 0;
  for (const c of certs) {
    const s = certStatus(c);
    if (s === 'expired') expired++;
    else if (s === 'needs_renewal' && !pendingByCert.has(c.id)) expiringNoRenewal++;
  }
  return {
    expired,
    expiring_no_renewal: expiringNoRenewal,
    pending_approval: renewals.filter((r) => r.status === 'pending_approval').length,
    approved_recent: renewals.filter((r) => r.status === 'approved').length,
  };
}
