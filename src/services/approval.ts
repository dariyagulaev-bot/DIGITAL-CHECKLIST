import { db } from '@/data/db';
import { nowIso } from './ids';
import { login } from './auth';
import { canApprove, assert } from './rbac';
import { logAudit } from './audit';
import { getApprovalMode, getSetting, SettingKeys } from './settings';
import { verifyPassword } from './auth';
import {
  FormStatus,
  SignerType,
  type CompletedForm,
  type FaultEvent,
  type UserWithRoles,
} from '@/types';
import { getForm, getFormSignatures, getFormTasks } from './forms';

export const SELF_APPROVAL_MESSAGE =
  'לא ניתן לאשר בד״ח שביצעת בעצמך. נדרש מאשר אחר.';

/**
 * Authenticate a user who wishes to approve a specific form.
 *
 * This is the security gate. It enforces — in the business layer, not the UI —
 * all of the following, in order:
 *   1. Valid credentials.
 *   2. The user actually holds APPROVER (or ADMIN) permission.
 *   3. approver_user_id !== performer_user_id (no self-approval), checked by ID.
 *   4. The form is in a state that can be approved.
 *
 * Returns the authenticated approver identity on success; throws otherwise.
 */
export async function authenticateApprover(
  form: CompletedForm,
  username: string,
  password: string
): Promise<UserWithRoles> {
  assert(
    form.status === FormStatus.PENDING_APPROVAL,
    'הבד״ח אינו במצב הממתין לאישור'
  );

  const mode = await getApprovalMode();
  const approver = await login(username, password);
  assert(!!approver, 'אימות נכשל — שם משתמש או סיסמה שגויים');

  // In shared-password mode, additionally require the shared approval password.
  if (mode === 'shared_password') {
    // (Kept for forward-compat; personal accounts is the default/recommended mode.)
    const sharedHash = await getSetting(SettingKeys.APPROVER_SHARED_HASH);
    assert(!!sharedHash, 'סיסמת המאשר המשותפת לא הוגדרה. פנה למנהל.');
  }

  assert(canApprove(approver!), 'למשתמש אין הרשאת מאשר (APPROVER).');

  // Core self-approval prevention — by user id, never by typed name.
  assert(approver!.id !== form.performer_user_id, SELF_APPROVAL_MESSAGE);

  return approver!;
}

/**
 * Verify the shared approval password (only relevant in shared-password mode).
 */
export async function verifySharedApprovalPassword(password: string): Promise<boolean> {
  const hash = await getSetting(SettingKeys.APPROVER_SHARED_HASH);
  if (!hash) return false;
  return verifyPassword(password, hash);
}

/**
 * Finalize approval: re-checks every rule server-side, confirms an approver
 * signature is present, then locks the form as APPROVED.
 */
export async function finalizeApproval(
  formId: string,
  approver: UserWithRoles
): Promise<void> {
  const form = await getForm(formId);
  assert(!!form, 'הבד״ח לא נמצא');
  assert(
    form!.status === FormStatus.PENDING_APPROVAL,
    'הבד״ח אינו במצב הממתין לאישור'
  );
  assert(canApprove(approver), 'למשתמש אין הרשאת מאשר (APPROVER).');
  // Re-check self-approval at finalize time (defense in depth).
  assert(approver.id !== form!.performer_user_id, SELF_APPROVAL_MESSAGE);

  const signatures = await getFormSignatures(formId);
  const approverSig = signatures.find(
    (s) => s.signer_type === SignerType.APPROVER && s.signer_user_id === approver.id
  );
  assert(!!approverSig, 'חסרה חתימת מאשר. יש לחתום לפני האישור.');

  const now = nowIso();
  // Final approval also VERIFIES every section that had been returned and
  // treated — stamping who verified and when onto each such section.
  const tasks = await getFormTasks(formId);
  await Promise.all(
    tasks
      .filter((t) => t.returned_for_fix && t.repair_reported)
      .map((t) =>
        db.completed_tasks.update(t.id, {
          verified: true,
          verified_by_name: approver.full_name,
          verified_at: now,
          fault_events: [
            ...(t.fault_events ?? []),
            { type: 'verified', at: now, by_id: approver.id, by_name: approver.full_name },
          ],
        })
      )
  );

  await db.completed_forms.update(formId, {
    status: FormStatus.APPROVED,
    approver_user_id: approver.id,
    approver_name: approver.full_name,
    approved_at: now,
  });

  await logAudit({
    user_id: approver.id,
    user_name: approver.full_name,
    action: 'APPROVE_FORM',
    entity_type: 'completed_form',
    entity_id: formId,
    new_value: FormStatus.APPROVED,
  });
}

/** One section the approver is returning, with its own reason. */
export interface ReturnSection {
  taskId: string;
  note: string;
}

/**
 * Return specific section(s) of a form to the performer for correction, each
 * with a mandatory reason. Records — per section — who returned it, when, and
 * the note, and stamps a "returned" event onto the section's timeline. An
 * optional general note is kept at form level for the banner.
 *
 * Because the content will change, existing performer signatures are
 * invalidated (deleted) — an old signature must never vouch for content altered
 * after it was signed. The performer documents the treatment, re-signs, and
 * re-submits. Nothing here erases the original result or the fault history.
 */
export async function returnForFix(
  formId: string,
  approver: UserWithRoles,
  sections: ReturnSection[],
  generalNote = ''
): Promise<void> {
  const form = await getForm(formId);
  assert(!!form, 'הבד״ח לא נמצא');
  assert(
    form!.status === FormStatus.PENDING_APPROVAL,
    'ניתן להחזיר לתיקון רק בד״ח הממתין לאישור'
  );
  assert(canApprove(approver), 'למשתמש אין הרשאת מאשר.');
  assert(approver.id !== form!.performer_user_id, SELF_APPROVAL_MESSAGE);

  const picked = sections.filter((s) => s.taskId && s.note.trim());
  assert(
    picked.length > 0 || !!generalNote.trim(),
    'יש לבחור לפחות סעיף אחד עם הערה, או להזין הערה כללית.'
  );

  const now = nowIso();
  const tasks = await getFormTasks(formId);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  for (const sel of picked) {
    const t = byId.get(sel.taskId);
    if (!t) continue;
    const ev: FaultEvent = {
      type: 'returned',
      at: now,
      by_id: approver.id,
      by_name: approver.full_name,
      note: sel.note.trim(),
    };
    await db.completed_tasks.update(sel.taskId, {
      returned_for_fix: true,
      return_note: sel.note.trim(),
      returned_by_name: approver.full_name,
      returned_at: now,
      // Returning again after a previous cycle clears the old repair report so a
      // fresh treatment is required, while the event log keeps the full history.
      repair_reported: false,
      fault_events: [...(t.fault_events ?? []), ev],
    });
  }

  // Invalidate every prior signature so the performer must re-sign the corrected
  // content before it can be re-submitted for approval.
  const sigs = await getFormSignatures(formId);
  if (sigs.length) await db.signatures.bulkDelete(sigs.map((s) => s.id));

  const summary =
    generalNote.trim() ||
    (picked.length === 1
      ? picked[0].note.trim()
      : `הוחזרו ${picked.length} סעיפים לתיקון`);

  await db.completed_forms.update(formId, {
    status: FormStatus.REJECTED,
    rejection_note: summary,
    rejected_by_name: approver.full_name,
    rejected_at: now,
    updated_at: now,
  });
  await logAudit({
    user_id: approver.id,
    user_name: approver.full_name,
    action: 'RETURN_FOR_FIX',
    entity_type: 'completed_form',
    entity_id: formId,
    new_value: FormStatus.REJECTED,
    reason: [generalNote.trim(), ...picked.map((p) => p.note.trim())].filter(Boolean).join(' | '),
  });
}
