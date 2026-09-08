import { beforeEach, describe, expect, it } from 'vitest';
import {
  addSignature,
  createDraftForm,
  getForm,
  getFormTasks,
  setTaskResult,
  submitForApproval,
} from './forms';
import { addTask, createTemplate } from './templates';
import {
  authenticateApprover,
  finalizeApproval,
  SELF_APPROVAL_MESSAGE,
} from './approval';
import { adminSetTaskResult } from './adminForms';
import { listAudit } from './audit';
import { FormStatus, RoleName, SignerType, TaskResult, type UserWithRoles } from '@/types';
import { ensureRoles, makeUser, resetDb } from '@/test/helpers';

const SIG = 'data:image/png;base64,AAAA';

/** Build a fully completed form submitted for approval by `performer`. */
async function buildSubmittedForm(performer: UserWithRoles): Promise<string> {
  const t = await createTemplate({ name: 'בדיקה יומית' });
  await addTask(t.id, { part_name: 'מנוע', action: 'שמן', equipment: 'כפפות' });
  await addTask(t.id, { part_name: 'חשמל', action: 'חיבורים', equipment: 'פנס' });
  const formId = await createDraftForm({ templateId: t.id, performer });
  const tasks = await getFormTasks(formId);
  await setTaskResult(formId, performer.id, tasks[0].id, TaskResult.OK);
  await setTaskResult(formId, performer.id, tasks[1].id, TaskResult.FAULT);
  const { setTaskComment } = await import('./forms');
  await setTaskComment(formId, performer.id, tasks[1].id, 'חיבור רופף');
  await addSignature({
    formId,
    signer: performer,
    type: SignerType.PERFORMER,
    signerRole: 'טכנאי',
    signatureData: SIG,
  });
  await submitForApproval(formId, performer.id);
  return formId;
}

describe('approval & self-approval prevention', () => {
  let performer: UserWithRoles;
  let approver: UserWithRoles;
  let performerAlsoApprover: UserWithRoles;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    performer = await makeUser('perf', 'ישראל ישראלי', [RoleName.PERFORMER], 'perfpw');
    approver = await makeUser('appr', 'דנה כהן', [RoleName.APPROVER], 'apprpw');
    performerAlsoApprover = await makeUser(
      'both',
      'רב-תפקיד',
      [RoleName.PERFORMER, RoleName.APPROVER],
      'bothpw'
    );
  });

  it('blocks a user from approving a form they performed — even with APPROVER role', async () => {
    const formId = await buildSubmittedForm(performerAlsoApprover);
    const form = await getForm(formId);
    await expect(
      authenticateApprover(form!, 'both', 'bothpw')
    ).rejects.toThrow(SELF_APPROVAL_MESSAGE);
  });

  it('blocks a user without APPROVER permission', async () => {
    const formId = await buildSubmittedForm(performer);
    const form = await getForm(formId);
    // performer has only PERFORMER role
    await expect(authenticateApprover(form!, 'perf', 'perfpw')).rejects.toThrow(/הרשאת מאשר/);
  });

  it('rejects wrong approver credentials', async () => {
    const formId = await buildSubmittedForm(performer);
    const form = await getForm(formId);
    await expect(authenticateApprover(form!, 'appr', 'wrong')).rejects.toThrow(/אימות/);
  });

  it('authenticates a valid, distinct approver', async () => {
    const formId = await buildSubmittedForm(performer);
    const form = await getForm(formId);
    const a = await authenticateApprover(form!, 'appr', 'apprpw');
    expect(a.id).toBe(approver.id);
  });

  it('finalize requires an approver signature', async () => {
    const formId = await buildSubmittedForm(performer);
    await expect(finalizeApproval(formId, approver)).rejects.toThrow(/חתימת מאשר/);
  });

  it('finalize refuses self-approval as defense in depth', async () => {
    const formId = await buildSubmittedForm(performerAlsoApprover);
    // Even if a signature were added, finalize must refuse.
    await addSignature({
      formId,
      signer: performerAlsoApprover,
      type: SignerType.APPROVER,
      signerRole: '',
      signatureData: SIG,
    });
    await expect(finalizeApproval(formId, performerAlsoApprover)).rejects.toThrow(
      SELF_APPROVAL_MESSAGE
    );
  });

  it('completes the full approve flow: sign → finalize → APPROVED + audit', async () => {
    const formId = await buildSubmittedForm(performer);
    const form = await getForm(formId);
    const a = await authenticateApprover(form!, 'appr', 'apprpw');
    await addSignature({
      formId,
      signer: a,
      type: SignerType.APPROVER,
      signerRole: 'מהנדס',
      signatureData: SIG,
    });
    await finalizeApproval(formId, a);

    const finalForm = await getForm(formId);
    expect(finalForm!.status).toBe(FormStatus.APPROVED);
    expect(finalForm!.approver_user_id).toBe(approver.id);
    expect(finalForm!.approved_at).not.toBeNull();

    const audit = await listAudit();
    expect(audit.some((e) => e.action === 'APPROVE_FORM' && e.entity_id === formId)).toBe(true);
  });

  it('admin editing an approved form revokes approval and requires re-approval', async () => {
    const admin = await makeUser('admin', 'מנהל', [RoleName.ADMIN], 'adminpw');
    const formId = await buildSubmittedForm(performer);
    const form = await getForm(formId);
    const a = await authenticateApprover(form!, 'appr', 'apprpw');
    await addSignature({
      formId,
      signer: a,
      type: SignerType.APPROVER,
      signerRole: '',
      signatureData: SIG,
    });
    await finalizeApproval(formId, a);
    expect((await getForm(formId))!.status).toBe(FormStatus.APPROVED);

    const tasks = await getFormTasks(formId);
    await adminSetTaskResult({
      admin,
      formId,
      taskId: tasks[0].id,
      result: TaskResult.FAULT,
      reason: 'תיקון לאחר ביקורת',
    });

    const after = await getForm(formId);
    expect(after!.status).toBe(FormStatus.PENDING_APPROVAL);
    expect(after!.approver_user_id).toBeNull();

    const audit = await listAudit();
    expect(audit.some((e) => e.action === 'REVOKE_APPROVAL_ON_EDIT')).toBe(true);
  });
});
