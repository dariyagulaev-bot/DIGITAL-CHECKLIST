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
  type UserWithRoles,
} from '@/types';
import { getForm, getFormSignatures } from './forms';

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

  await db.completed_forms.update(formId, {
    status: FormStatus.APPROVED,
    approver_user_id: approver.id,
    approver_name: approver.full_name,
    approved_at: nowIso(),
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

/** Reject a form back to the performer for correction (optional workflow). */
export async function rejectForm(
  formId: string,
  approver: UserWithRoles,
  reason: string
): Promise<void> {
  const form = await getForm(formId);
  assert(!!form, 'הבד״ח לא נמצא');
  assert(
    form!.status === FormStatus.PENDING_APPROVAL,
    'ניתן לדחות רק בד״ח הממתין לאישור'
  );
  assert(canApprove(approver), 'למשתמש אין הרשאת מאשר.');
  assert(approver.id !== form!.performer_user_id, SELF_APPROVAL_MESSAGE);

  await db.completed_forms.update(formId, { status: FormStatus.REJECTED });
  await logAudit({
    user_id: approver.id,
    user_name: approver.full_name,
    action: 'REJECT_FORM',
    entity_type: 'completed_form',
    entity_id: formId,
    new_value: FormStatus.REJECTED,
    reason,
  });
}
