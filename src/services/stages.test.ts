import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, ensureRoles, makeUser, certifyAllSystems } from '@/test/helpers';
import { createTemplate, addTask } from './templates';
import { ensureBlocks, getTemplateBlocks } from './blocks';
import { setUsesStages, renameStage, setBlockStages, getStages, addStage, removeStage } from './stages';
import { publishTemplate } from './publish';
import { createDraftForm, getFormBundle, getFormTasks, setTaskResult } from './forms';
import { RoleName, TaskResult, type UserWithRoles } from '@/types';

describe('work stages (לפני / אחרי)', () => {
  let admin: UserWithRoles;
  let perf: UserWithRoles;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    admin = await makeUser('adm', 'מנהל', [RoleName.ADMIN]);
    perf = await makeUser('perf', 'ישראל ישראלי', [RoleName.PERFORMER]);
  });

  async function twoCheckTemplate() {
    const t = await createTemplate({ name: 'בד״ח דרג א׳' });
    await addTask(t.id, { part_name: 'מנוע', action: 'בדיקת שמן', equipment: 'כפפות' });
    await addTask(t.id, { part_name: 'חשמל', action: 'בדיקת חיבורים', equipment: 'פנס' });
    await certifyAllSystems(perf.id);
    await ensureBlocks(t.id); // persist real blocks so stages can be assigned
    const blocks = await getTemplateBlocks(t.id);
    return { template: t, blocks };
  }

  it('defaults to לפני/אחרי with stable ids, and names are editable (not hardcoded)', async () => {
    const { template } = await twoCheckTemplate();
    const stages = await setUsesStages(template.id, true);
    expect(stages.map((s) => s.id)).toEqual(['stage_1', 'stage_2']);
    expect(stages.map((s) => s.name)).toEqual(['לפני', 'אחרי']);
    await renameStage(template.id, 'stage_1', 'לפני הכנה');
    await renameStage(template.id, 'stage_2', 'אחרי הכנה');
    const renamed = await getStages(template.id);
    expect(renamed.map((s) => s.name)).toEqual(['לפני הכנה', 'אחרי הכנה']);
    expect(renamed.map((s) => s.id)).toEqual(['stage_1', 'stage_2']); // ids unchanged
  });

  it('a check in two stages yields two independent results; one stage never overwrites the other', async () => {
    const { template, blocks } = await twoCheckTemplate();
    await setUsesStages(template.id, true);
    await renameStage(template.id, 'stage_1', 'לפני הכנה');
    await renameStage(template.id, 'stage_2', 'אחרי הכנה');
    await setBlockStages(blocks[0].id, ['stage_1', 'stage_2']); // מנוע in both
    await setBlockStages(blocks[1].id, ['stage_1']); // חשמל only before

    const formId = await createDraftForm({ templateId: template.id, performer: perf });
    const tasks = await getFormTasks(formId);
    // מנוע×2 (before+after) + חשמל×1 (before) = 3 instances
    expect(tasks).toHaveLength(3);
    const motor = tasks.filter((t) => t.part_name_snapshot === 'מנוע');
    expect(motor).toHaveLength(2);
    expect(new Set(motor.map((t) => t.stage_id))).toEqual(new Set(['stage_1', 'stage_2']));
    expect(new Set(motor.map((t) => t.stage_name_snapshot))).toEqual(new Set(['לפני הכנה', 'אחרי הכנה']));

    // Mark the "before" motor check תקין; the "after" one must stay UNSET.
    const before = motor.find((t) => t.stage_id === 'stage_1')!;
    const after = motor.find((t) => t.stage_id === 'stage_2')!;
    await setTaskResult(formId, perf.id, before.id, TaskResult.OK);
    const re = await getFormTasks(formId);
    expect(re.find((t) => t.id === before.id)!.result).toBe(TaskResult.OK);
    expect(re.find((t) => t.id === after.id)!.result).toBe(TaskResult.UNSET);
  });

  it('snapshot freezes stage names — renaming after a form is created never changes it', async () => {
    const { template, blocks } = await twoCheckTemplate();
    await setUsesStages(template.id, true);
    await renameStage(template.id, 'stage_1', 'בדיקה ראשונית');
    await setBlockStages(blocks[0].id, ['stage_1']);
    const formId = await createDraftForm({ templateId: template.id, performer: perf });
    await renameStage(template.id, 'stage_1', 'שם אחר לגמרי'); // later edit
    const bundle = await getFormBundle(formId);
    const motor = bundle!.tasks.find((t) => t.part_name_snapshot === 'מנוע')!;
    expect(motor.stage_name_snapshot).toBe('בדיקה ראשונית'); // frozen
    expect(bundle!.form.template_snapshot.stages?.map((s) => s.name)).toContain('בדיקה ראשונית');
  });

  it('turning stages off is flat and backward-compatible (one instance, no stage)', async () => {
    const { template } = await twoCheckTemplate();
    const formId = await createDraftForm({ templateId: template.id, performer: perf });
    const tasks = await getFormTasks(formId);
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => !t.stage_id)).toBe(true);
  });

  it('published version freezes stages; a third stage can be added without rearchitecting', async () => {
    const { template, blocks } = await twoCheckTemplate();
    await setUsesStages(template.id, true);
    await setBlockStages(blocks[0].id, ['stage_1', 'stage_2']);
    const s3 = await addStage(template.id, 'לאחר הפעלה');
    expect(s3.id).toBe('stage_3');
    await setBlockStages(blocks[1].id, ['stage_3']);
    await publishTemplate(template.id, admin);
    const formId = await createDraftForm({ templateId: template.id, performer: perf });
    const tasks = await getFormTasks(formId);
    // מנוע×2 + חשמל×1(stage_3) = 3
    expect(tasks).toHaveLength(3);
    expect(tasks.some((t) => t.stage_id === 'stage_3')).toBe(true);
  });

  it('removing a stage strips it from blocks', async () => {
    const { template, blocks } = await twoCheckTemplate();
    await setUsesStages(template.id, true);
    await setBlockStages(blocks[0].id, ['stage_1', 'stage_2']);
    await removeStage(template.id, 'stage_2');
    const after = await getTemplateBlocks(template.id);
    expect(after[0].stage_ids).toEqual(['stage_1']);
    expect((await getStages(template.id)).map((s) => s.id)).toEqual(['stage_1']);
  });
});
