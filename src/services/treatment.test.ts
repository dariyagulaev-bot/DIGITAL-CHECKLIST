import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, ensureRoles, makeUser } from '@/test/helpers';
import { RoleName, FormStatus, SignerType, TaskResult, type UserWithRoles } from '@/types';
import { createSystem } from '@/services/systems';
import { createRank } from '@/services/ranks';
import { createTemplate, addTask } from '@/services/templates';
import { setCertification } from '@/services/certifications';
import {
  addSignature,
  createDraftForm,
  getForm,
  getFormTasks,
  setTaskComment,
  setTaskResult,
  submitForApproval,
  updateFormMeta,
} from '@/services/forms';
import { finalizeApproval } from '@/services/approval';
import {
  transferToTreatmentRank,
  setTreatmentPerformers,
  reportTreatment,
  submitTreatmentForApproval,
  hasEnoughTreatmentManpower,
  validateTreatmentForApproval,
} from '@/services/treatment';
import { currentResult } from '@/exports/labels';

const SIG = 'data:image/png;base64,AAAA';

describe('transfer-to-treatment-rank (העברה לדרג מטפל)', () => {
  let admin: UserWithRoles;
  let perf: UserWithRoles; // performer 1 (rank א)
  let perf2: UserWithRoles; // performer 2 (rank א)
  let approver: UserWithRoles;
  let dPerf1: UserWithRoles; // treating rank ד performer
  let dPerf2: UserWithRoles; // treating rank ד performer
  let sysA: string;
  let rankA: string;
  let rankD: string;
  let faultTaskId: string;
  let formId: string;

  /** Build a submitted בד״ח (rank א) with one FAULT section. */
  async function buildSubmitted(): Promise<void> {
    const tpl = (await createTemplate({ name: 'בדיקה', system_id: sysA, rank_id: rankA })).id;
    await addTask(tpl, { part_name: 'מנוע', action: 'שמן', equipment: '' });
    await addTask(tpl, { part_name: 'חשמל', action: 'חיבור', equipment: '' });
    formId = await createDraftForm({ templateId: tpl, performer: perf });
    const tasks = await getFormTasks(formId);
    faultTaskId = tasks[1].id;
    await setTaskResult(formId, perf.id, tasks[0].id, TaskResult.OK);
    await setTaskResult(formId, perf.id, tasks[1].id, TaskResult.FAULT);
    await setTaskComment(formId, perf.id, tasks[1].id, 'חיבור רופף');
    await addSignature({ formId, signer: perf, type: SignerType.PERFORMER, signatureData: SIG });
    await updateFormMeta(formId, perf.id, { performer2_id: perf2.id, performer2_name: perf2.full_name });
    await addSignature({
      formId,
      signer: { id: perf2.id, full_name: perf2.full_name },
      type: SignerType.PERFORMER2,
      signatureData: SIG,
    });
    await submitForApproval(formId, perf.id);
  }

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    admin = await makeUser('admin', 'מנהל', [RoleName.ADMIN]);
    perf = await makeUser('perf', 'ישראל', [RoleName.PERFORMER], 'pw');
    perf2 = await makeUser('perf2', 'דני', [RoleName.PERFORMER], 'pw');
    approver = await makeUser('appr', 'דנה', [RoleName.APPROVER], 'pw');
    dPerf1 = await makeUser('d1', 'מומחה א', [RoleName.PERFORMER], 'pw');
    dPerf2 = await makeUser('d2', 'מומחה ב', [RoleName.PERFORMER], 'pw');
    sysA = (await createSystem('מערכת א׳')).id;
    rankA = (await createRank('דרג א׳')).id; // sort 0
    rankD = (await createRank('דרג ד׳')).id; // sort 1
    // Original performers certified to rank א.
    await setCertification(perf.id, sysA, rankA, admin);
    await setCertification(perf2.id, sysA, rankA, admin);
    await buildSubmitted();
  });

  it('manpower gate: transfer is blocked until enough rank-ד performers exist', async () => {
    expect(await hasEnoughTreatmentManpower(sysA, rankD)).toBe(false);
    await expect(
      transferToTreatmentRank({
        formId,
        approver,
        treatmentRankId: rankD,
        sections: [{ taskId: faultTaskId, note: 'דורש טיפול דרג ד׳' }],
      })
    ).rejects.toThrow(/מספיק מבצעים/);

    // Certify two performers to rank ד → manpower satisfied.
    await setCertification(dPerf1.id, sysA, rankD, admin);
    await setCertification(dPerf2.id, sysA, rankD, admin);
    expect(await hasEnoughTreatmentManpower(sysA, rankD)).toBe(true);
  });

  it('only "לא תקין" sections may be transferred, and only from PENDING_APPROVAL', async () => {
    await setCertification(dPerf1.id, sysA, rankD, admin);
    await setCertification(dPerf2.id, sysA, rankD, admin);
    const okTaskId = (await getFormTasks(formId)).find((t) => t.result === TaskResult.OK)!.id;
    await expect(
      transferToTreatmentRank({
        formId,
        approver,
        treatmentRankId: rankD,
        sections: [{ taskId: okTaskId, note: 'x' }],
      })
    ).rejects.toThrow(/לא תקין/);
  });

  it('full flow: transfer → assign repair performers → document → sign → resubmit → verify', async () => {
    await setCertification(dPerf1.id, sysA, rankD, admin);
    await setCertification(dPerf2.id, sysA, rankD, admin);

    // Approver transfers the fault section to the treating rank ד.
    await transferToTreatmentRank({
      formId,
      approver,
      treatmentRankId: rankD,
      sections: [{ taskId: faultTaskId, note: 'נדרש טיפול דרג ד׳' }],
      generalNote: 'הועבר לטיפול מיוחד',
    });
    let form = await getForm(formId);
    expect(form!.status).toBe(FormStatus.IN_TREATMENT);
    expect(form!.treatment_rank_id).toBe(rankD);
    expect(form!.treatment_rank_name).toBe('דרג ד׳');
    // Original inspection rank + performers are untouched.
    expect(form!.rank_id).toBe(rankA);
    expect(form!.performer_user_id).toBe(perf.id);
    expect(form!.performer2_id).toBe(perf2.id);
    let task = (await getFormTasks(formId)).find((t) => t.id === faultTaskId)!;
    expect(task.transferred_for_treatment).toBe(true);
    expect(task.result).toBe(TaskResult.FAULT); // original frozen

    // Cannot pick the same repair performer twice.
    await expect(
      setTreatmentPerformers({
        formId,
        actingUserId: dPerf1.id,
        performer1Id: dPerf1.id,
        performer1Name: dPerf1.full_name,
        performer2Id: dPerf1.id,
        performer2Name: dPerf1.full_name,
      })
    ).rejects.toThrow(/אותו מבצע/);

    // An uncertified user cannot be a repair performer.
    await expect(
      setTreatmentPerformers({
        formId,
        actingUserId: dPerf1.id,
        performer1Id: dPerf1.id,
        performer1Name: dPerf1.full_name,
        performer2Id: perf2.id, // only rank א
        performer2Name: perf2.full_name,
      })
    ).rejects.toThrow(/מוסמך/);

    await setTreatmentPerformers({
      formId,
      actingUserId: dPerf1.id,
      performer1Id: dPerf1.id,
      performer1Name: dPerf1.full_name,
      performer2Id: dPerf2.id,
      performer2Name: dPerf2.full_name,
    });

    // A user who is not an assigned repair performer cannot document.
    await expect(
      reportTreatment({
        formId,
        actingUserId: perf.id,
        taskId: faultTaskId,
        done: true,
        description: 'x',
        image: null,
      })
    ).rejects.toThrow();

    // "done" requires a description.
    await expect(
      reportTreatment({
        formId,
        actingUserId: dPerf1.id,
        taskId: faultTaskId,
        done: true,
        description: '  ',
        image: null,
      })
    ).rejects.toThrow(/לפרט/);

    await reportTreatment({
      formId,
      actingUserId: dPerf1.id,
      taskId: faultTaskId,
      done: true,
      description: 'הוחלף מחבר ובוצעה בדיקה חוזרת',
      image: null,
    });
    task = (await getFormTasks(formId)).find((t) => t.id === faultTaskId)!;
    expect(task.repair_reported).toBe(true);
    expect(task.repaired_by_name).toBe('מומחה א');

    // Cannot resubmit before both repair performers signed.
    let v = await validateTreatmentForApproval(formId);
    expect(v.ok).toBe(false);
    await expect(submitTreatmentForApproval(formId, dPerf1.id)).rejects.toThrow();

    await addSignature({
      formId,
      signer: dPerf1,
      type: SignerType.REPAIR_PERFORMER,
      signatureData: SIG,
    });
    await addSignature({
      formId,
      signer: dPerf2,
      type: SignerType.REPAIR_PERFORMER2,
      signatureData: SIG,
    });
    v = await validateTreatmentForApproval(formId);
    expect(v.ok).toBe(true);

    await submitTreatmentForApproval(formId, dPerf1.id);
    form = await getForm(formId);
    expect(form!.status).toBe(FormStatus.PENDING_APPROVAL);

    // Approver verifies at final approval. Original performer signatures kept.
    await addSignature({ formId, signer: approver, type: SignerType.APPROVER, signatureData: SIG });
    await finalizeApproval(formId, approver);
    form = await getForm(formId);
    expect(form!.status).toBe(FormStatus.APPROVED);
    task = (await getFormTasks(formId)).find((t) => t.id === faultTaskId)!;
    expect(task.verified).toBe(true);
    // Original result stays "לא תקין"; CURRENT status flips to "תקין".
    expect(task.result).toBe(TaskResult.FAULT);
    expect(currentResult(task)).toBe(TaskResult.OK);
    // The event chain tells the whole story in order.
    const types = (task.fault_events ?? []).map((e) => e.type);
    expect(types).toEqual(['discovered', 'transferred', 'repair_reported', 'resubmitted', 'verified']);
  });

  it('self-approval prevention also blocks a transfer by the performer', async () => {
    await setCertification(dPerf1.id, sysA, rankD, admin);
    await setCertification(dPerf2.id, sysA, rankD, admin);
    const selfApprover = await makeUser('both', 'רב', [RoleName.PERFORMER, RoleName.APPROVER], 'pw');
    await setCertification(selfApprover.id, sysA, rankA, admin);
    // Build a form performed by the self-approver.
    const tpl = (await createTemplate({ name: 'בדיקה2', system_id: sysA, rank_id: rankA })).id;
    await addTask(tpl, { part_name: 'a', action: 'b', equipment: '' });
    const fId = await createDraftForm({ templateId: tpl, performer: selfApprover });
    const tasks = await getFormTasks(fId);
    await setTaskResult(fId, selfApprover.id, tasks[0].id, TaskResult.FAULT);
    await setTaskComment(fId, selfApprover.id, tasks[0].id, 'תקלה');
    await addSignature({ formId: fId, signer: selfApprover, type: SignerType.PERFORMER, signatureData: SIG });
    await updateFormMeta(fId, selfApprover.id, { performer2_id: perf2.id, performer2_name: perf2.full_name });
    await addSignature({
      formId: fId,
      signer: { id: perf2.id, full_name: perf2.full_name },
      type: SignerType.PERFORMER2,
      signatureData: SIG,
    });
    await submitForApproval(fId, selfApprover.id);
    await expect(
      transferToTreatmentRank({
        formId: fId,
        approver: selfApprover,
        treatmentRankId: rankD,
        sections: [{ taskId: tasks[0].id, note: 'x' }],
      })
    ).rejects.toThrow();
  });
});
