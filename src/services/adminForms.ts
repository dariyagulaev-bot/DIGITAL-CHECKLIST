import { db } from '@/data/db';
import { logAudit } from './audit';
import { getForm, getFormTasks, getFormSignatures } from './forms';
import {
  FormStatus,
  SignerType,
  TaskResult,
  type UserWithRoles,
} from '@/types';
import { assert, isAdmin } from './rbac';

/**
 * Admin override edits. These are the only way to change a form after it has
 * moved past the performer stage, and every change is written to the audit log.
 *
 * Per spec §28: if the material content of an APPROVED form changes, the
 * approval is revoked (approver signature removed, status → PENDING_APPROVAL)
 * so an old signature can never certify data that was altered after signing.
 */

async function revokeApprovalIfNeeded(formId: string, admin: UserWithRoles): Promise<void> {
  const form = await getForm(formId);
  if (!form) return;
  if (form.status === FormStatus.APPROVED) {
    // Remove approver signature and reset to pending.
    const sigs = await getFormSignatures(formId);
    const approverSigs = sigs.filter((s) => s.signer_type === SignerType.APPROVER);
    await db.signatures.bulkDelete(approverSigs.map((s) => s.id));
    await db.completed_forms.update(formId, {
      status: FormStatus.PENDING_APPROVAL,
      approver_user_id: null,
      approver_name: null,
      approved_at: null,
    });
    await logAudit({
      user_id: admin.id,
      user_name: admin.full_name,
      action: 'REVOKE_APPROVAL_ON_EDIT',
      entity_type: 'completed_form',
      entity_id: formId,
      old_value: FormStatus.APPROVED,
      new_value: FormStatus.PENDING_APPROVAL,
      reason: 'תוכן הבד״ח שונה לאחר אישור — נדרש אישור מחדש',
    });
  }
}

export async function adminSetTaskResult(params: {
  admin: UserWithRoles;
  formId: string;
  taskId: string;
  result: TaskResult;
  reason: string;
}): Promise<void> {
  assert(isAdmin(params.admin), 'נדרשת הרשאת מנהל');
  assert(!!params.reason.trim(), 'יש לציין סיבת שינוי');
  const tasks = await getFormTasks(params.formId);
  const task = tasks.find((t) => t.id === params.taskId);
  assert(!!task, 'הסעיף לא נמצא');
  const old = task!.result;
  await revokeApprovalIfNeeded(params.formId, params.admin);
  const patch: Partial<typeof task> = { result: params.result };
  if (params.result !== TaskResult.FAULT) {
    patch.comment = '';
    patch.fault_image = null;
  }
  await db.completed_tasks.update(params.taskId, patch);
  await logAudit({
    user_id: params.admin.id,
    user_name: params.admin.full_name,
    action: 'ADMIN_EDIT_TASK_RESULT',
    entity_type: 'completed_task',
    entity_id: params.taskId,
    field: 'result',
    old_value: old,
    new_value: params.result,
    reason: params.reason,
  });
}

export async function adminSetTaskComment(params: {
  admin: UserWithRoles;
  formId: string;
  taskId: string;
  comment: string;
  reason: string;
}): Promise<void> {
  assert(isAdmin(params.admin), 'נדרשת הרשאת מנהל');
  assert(!!params.reason.trim(), 'יש לציין סיבת שינוי');
  const tasks = await getFormTasks(params.formId);
  const task = tasks.find((t) => t.id === params.taskId);
  assert(!!task, 'הסעיף לא נמצא');
  const old = task!.comment;
  await revokeApprovalIfNeeded(params.formId, params.admin);
  await db.completed_tasks.update(params.taskId, { comment: params.comment });
  await logAudit({
    user_id: params.admin.id,
    user_name: params.admin.full_name,
    action: 'ADMIN_EDIT_TASK_COMMENT',
    entity_type: 'completed_task',
    entity_id: params.taskId,
    field: 'comment',
    old_value: old,
    new_value: params.comment,
    reason: params.reason,
  });
}
