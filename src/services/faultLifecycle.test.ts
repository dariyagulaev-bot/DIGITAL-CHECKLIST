import { beforeEach, describe, expect, it } from 'vitest';
import {
  addSignature,
  createDraftForm,
  getForm,
  getFormTasks,
  reportRepair,
  setTaskComment,
  setTaskResult,
  submitForApproval,
  updateFormMeta,
  validateForSubmit,
} from './forms';
import { addTask, createTemplate } from './templates';
import { finalizeApproval, returnForFix } from './approval';
import { FormStatus, RoleName, SignerType, TaskResult, type UserWithRoles } from '@/types';
import { ensureRoles, makeUser, resetDb } from '@/test/helpers';

const SIG = 'data:image/png;base64,AAAA';

async function signBoth(formId: string, performer: UserWithRoles) {
  await addSignature({ formId, signer: performer, type: SignerType.PERFORMER, signatureData: SIG });
  await addSignature({
    formId,
    signer: { id: 'perf2', full_name: 'דוד כהן' },
    type: SignerType.PERFORMER2,
    signatureData: SIG,
  });
}

describe('fault-handling lifecycle', () => {
  let performer: UserWithRoles;
  let approver: UserWithRoles;
  let faultTaskId: string;
  let formId: string;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    performer = await makeUser('perf', 'ישראל ישראלי', [RoleName.PERFORMER], 'pw');
    approver = await makeUser('appr', 'דנה כהן', [RoleName.APPROVER], 'pw');

    const t = await createTemplate({ name: 'בדיקה' });
    await addTask(t.id, { part_name: 'מנוע', action: 'שמן', equipment: 'כפפות' });
    await addTask(t.id, { part_name: 'חשמל', action: 'חיבורים', equipment: 'פנס' });
    formId = await createDraftForm({ templateId: t.id, performer });
    const tasks = await getFormTasks(formId);
    faultTaskId = tasks[1].id;
    await setTaskResult(formId, performer.id, tasks[0].id, TaskResult.OK);
    await setTaskResult(formId, performer.id, tasks[1].id, TaskResult.FAULT);
    await setTaskComment(formId, performer.id, tasks[1].id, 'מחבר רופף');
    await updateFormMeta(formId, performer.id, { performer2_id: 'perf2', performer2_name: 'דוד כהן' });
    await signBoth(formId, performer);
    await submitForApproval(formId, performer.id);
  });

  it('records discovery (who + timestamp) and keeps the original result', async () => {
    const task = (await getFormTasks(formId)).find((t) => t.id === faultTaskId)!;
    expect(task.fault_reported_at).toBeTruthy();
    expect(task.fault_reported_by_name).toBe('ישראל ישראלי');
    expect(task.fault_events?.some((e) => e.type === 'discovered')).toBe(true);
  });

  it('runs the full loop: return section → repair → resubmit → verify — original stays "לא תקין"', async () => {
    // Approver returns the specific section with a note.
    await returnForFix(formId, approver, [{ taskId: faultTaskId, note: 'נדרש חיזוק ובדיקה חוזרת' }]);
    let task = (await getFormTasks(formId)).find((t) => t.id === faultTaskId)!;
    expect((await getForm(formId))!.status).toBe(FormStatus.REJECTED);
    expect(task.returned_for_fix).toBe(true);
    expect(task.return_note).toBe('נדרש חיזוק ובדיקה חוזרת');
    expect(task.returned_by_name).toBe('דנה כהן');

    // Cannot resubmit before the treatment is documented.
    let v = await validateForSubmit(formId);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toContain('טיפול');

    // Performer documents the repair.
    await reportRepair({
      formId,
      userId: performer.id,
      taskId: faultTaskId,
      done: true,
      description: 'המחבר חוזק ובוצעה בדיקה חוזרת',
      image: null,
    });
    task = (await getFormTasks(formId)).find((t) => t.id === faultTaskId)!;
    expect(task.repair_reported).toBe(true);
    expect(task.repair_done).toBe(true);
    expect(task.repaired_by_name).toBe('ישראל ישראלי');
    expect(task.repaired_at).toBeTruthy();

    // Re-sign (signatures were invalidated) and re-submit.
    await signBoth(formId, performer);
    v = await validateForSubmit(formId);
    expect(v.ok).toBe(true);
    await submitForApproval(formId, performer.id);
    expect((await getForm(formId))!.status).toBe(FormStatus.PENDING_APPROVAL);

    // Final approval verifies the treated section.
    await addSignature({ formId, signer: approver, type: SignerType.APPROVER, signatureData: SIG });
    await finalizeApproval(formId, approver);
    task = (await getFormTasks(formId)).find((t) => t.id === faultTaskId)!;
    expect((await getForm(formId))!.status).toBe(FormStatus.APPROVED);
    expect(task.verified).toBe(true);
    expect(task.verified_by_name).toBe('דנה כהן');
    // The ORIGINAL result is untouched.
    expect(task.result).toBe(TaskResult.FAULT);
    // The timeline has the full, ordered story.
    const types = (task.fault_events ?? []).map((e) => e.type);
    expect(types).toEqual(['discovered', 'returned', 'repair_reported', 'resubmitted', 'verified']);
  });

  it('blocks changing a returned section result (original frozen)', async () => {
    await returnForFix(formId, approver, [{ taskId: faultTaskId, note: 'לתקן' }]);
    await expect(
      setTaskResult(formId, performer.id, faultTaskId, TaskResult.OK)
    ).rejects.toThrow(/לא ניתן לשנות/);
  });
});
