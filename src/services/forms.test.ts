import { beforeEach, describe, expect, it } from 'vitest';
import {
  addSignature,
  createDraftForm,
  getFormBundle,
  getFormTasks,
  setTaskComment,
  setTaskFaultImage,
  setTaskResult,
  submitForApproval,
  updateFormMeta,
  validateForSubmit,
} from './forms';
import { addTask, createTemplate, updateTask } from './templates';
import { RoleName, SignerType, TaskResult, FormStatus, type UserWithRoles } from '@/types';
import { ensureRoles, makeUser, resetDb } from '@/test/helpers';

const SIG = 'data:image/png;base64,AAAA';

async function setupTemplate() {
  const t = await createTemplate({ name: 'בדיקה יומית' });
  const a = await addTask(t.id, { part_name: 'מנוע', action: 'בדיקת שמן', equipment: 'כפפות' });
  const b = await addTask(t.id, { part_name: 'חשמל', action: 'בדיקת חיבורים', equipment: 'פנס' });
  return { template: t, taskIds: [a.id, b.id] };
}

describe('forms service', () => {
  let performer: UserWithRoles;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    performer = await makeUser('perf', 'ישראל ישראלי', [RoleName.PERFORMER]);
  });

  it('creates a draft with a frozen template snapshot and one task per template task', async () => {
    const { template } = await setupTemplate();
    const formId = await createDraftForm({ templateId: template.id, performer });
    const bundle = await getFormBundle(formId);
    expect(bundle).not.toBeNull();
    expect(bundle!.form.status).toBe(FormStatus.DRAFT);
    expect(bundle!.form.template_snapshot.tasks).toHaveLength(2);
    expect(bundle!.tasks).toHaveLength(2);
    expect(bundle!.form.performer_name).toBe('ישראל ישראלי');
  });

  it('snapshot is immutable — later template edits do not change existing forms', async () => {
    const { template, taskIds } = await setupTemplate();
    const formId = await createDraftForm({ templateId: template.id, performer });
    await updateTask(taskIds[0], { part_name: 'מנוע ששונה', action: 'שונה' });
    const bundle = await getFormBundle(formId);
    const first = bundle!.tasks[0];
    expect(first.part_name_snapshot).toBe('מנוע');
    expect(bundle!.form.template_snapshot.tasks[0].part_name).toBe('מנוע');
  });

  it('OK and FAULT are mutually exclusive; marking OK clears fault detail', async () => {
    const { template } = await setupTemplate();
    const formId = await createDraftForm({ templateId: template.id, performer });
    const tasks = await getFormTasks(formId);
    await setTaskResult(formId, performer.id, tasks[0].id, TaskResult.FAULT);
    await setTaskComment(formId, performer.id, tasks[0].id, 'תקלה כלשהי');
    await setTaskFaultImage(formId, performer.id, tasks[0].id, SIG);
    let refreshed = (await getFormTasks(formId))[0];
    expect(refreshed.result).toBe(TaskResult.FAULT);
    expect(refreshed.comment).toBe('תקלה כלשהי');

    await setTaskResult(formId, performer.id, tasks[0].id, TaskResult.OK);
    refreshed = (await getFormTasks(formId))[0];
    expect(refreshed.result).toBe(TaskResult.OK);
    expect(refreshed.comment).toBe('');
    expect(refreshed.fault_image).toBeNull();
  });

  it('validation blocks submit until all tasks marked and performer signed', async () => {
    const { template } = await setupTemplate();
    const formId = await createDraftForm({ templateId: template.id, performer });
    const tasks = await getFormTasks(formId);

    let v = await validateForSubmit(formId);
    expect(v.ok).toBe(false);

    await setTaskResult(formId, performer.id, tasks[0].id, TaskResult.OK);
    await setTaskResult(formId, performer.id, tasks[1].id, TaskResult.OK);
    v = await validateForSubmit(formId);
    expect(v.ok).toBe(false); // still missing signature

    await addSignature({
      formId,
      signer: performer,
      type: SignerType.PERFORMER,
      signatureData: SIG,
    });
    v = await validateForSubmit(formId);
    expect(v.ok).toBe(false); // still missing the second performer
    expect(v.errors.join(' ')).toContain('שני מבצעים');

    await updateFormMeta(formId, performer.id, {
      performer2_id: 'perf2-id',
      performer2_name: 'דוד כהן',
    });
    v = await validateForSubmit(formId);
    expect(v.ok).toBe(false); // still missing the second performer's signature

    await addSignature({
      formId,
      signer: { id: 'perf2-id', full_name: 'דוד כהן' },
      type: SignerType.PERFORMER2,
      signatureData: SIG,
    });
    v = await validateForSubmit(formId);
    expect(v.ok).toBe(true);
  });

  it('a fault without detail fails validation', async () => {
    const { template } = await setupTemplate();
    const formId = await createDraftForm({ templateId: template.id, performer });
    const tasks = await getFormTasks(formId);
    await setTaskResult(formId, performer.id, tasks[0].id, TaskResult.FAULT); // no comment
    await setTaskResult(formId, performer.id, tasks[1].id, TaskResult.OK);
    await addSignature({
      formId,
      signer: performer,
      type: SignerType.PERFORMER,
      signatureData: SIG,
    });
    const v = await validateForSubmit(formId);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toContain('פירוט');
  });

  it('locks editing after submit for approval', async () => {
    const { template } = await setupTemplate();
    const formId = await createDraftForm({ templateId: template.id, performer });
    const tasks = await getFormTasks(formId);
    await setTaskResult(formId, performer.id, tasks[0].id, TaskResult.OK);
    await setTaskResult(formId, performer.id, tasks[1].id, TaskResult.OK);
    await addSignature({
      formId,
      signer: performer,
      type: SignerType.PERFORMER,
      signatureData: SIG,
    });
    await updateFormMeta(formId, performer.id, {
      performer2_id: 'perf2-id',
      performer2_name: 'דוד כהן',
    });
    await addSignature({
      formId,
      signer: { id: 'perf2-id', full_name: 'דוד כהן' },
      type: SignerType.PERFORMER2,
      signatureData: SIG,
    });
    await submitForApproval(formId, performer.id);

    await expect(
      updateFormMeta(formId, performer.id, { performer2_name: 'x' })
    ).rejects.toThrow();
    await expect(
      setTaskResult(formId, performer.id, tasks[0].id, TaskResult.FAULT)
    ).rejects.toThrow();
  });

  it('a non-performer cannot edit the form', async () => {
    const other = await makeUser('other', 'אחר', [RoleName.PERFORMER]);
    const { template } = await setupTemplate();
    const formId = await createDraftForm({ templateId: template.id, performer });
    await expect(updateFormMeta(formId, other.id, { performer2_name: 'x' })).rejects.toThrow();
  });
});
