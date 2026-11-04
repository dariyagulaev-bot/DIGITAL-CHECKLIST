import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, ensureRoles, makeUser, certifyAllSystems } from '@/test/helpers';
import { createTemplate, addTask } from './templates';
import { ensureBlocks } from './blocks';
import { setUsesStages, renameStage, getStages, addStage, removeStage } from './stages';
import { publishTemplate } from './publish';
import { createDraftForm, getFormBundle, getFormTasks, setFormPhase, validateForSubmit } from './forms';
import { RoleName, type UserWithRoles } from '@/types';

describe('בד״ח phase (שלב הבד״ח) — single-select classification', () => {
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
    await ensureBlocks(t.id);
    return t;
  }

  it('default options are לפני/אחרי with stable ids; names are editable', async () => {
    const t = await twoCheckTemplate();
    const stages = await setUsesStages(t.id, true);
    expect(stages.map((s) => s.id)).toEqual(['stage_1', 'stage_2']);
    expect(stages.map((s) => s.name)).toEqual(['לפני', 'אחרי']);
    await renameStage(t.id, 'stage_1', 'לפני הכנה');
    await renameStage(t.id, 'stage_2', 'אחרי הכנה');
    const renamed = await getStages(t.id);
    expect(renamed.map((s) => s.name)).toEqual(['לפני הכנה', 'אחרי הכנה']);
    expect(renamed.map((s) => s.id)).toEqual(['stage_1', 'stage_2']); // ids unchanged
  });

  it('the בד״ח stays a single flat table — the options are frozen onto the form', async () => {
    const t = await twoCheckTemplate();
    await setUsesStages(t.id, true);
    await renameStage(t.id, 'stage_1', 'לפני הכנה');
    await renameStage(t.id, 'stage_2', 'אחרי הכנה');
    await publishTemplate(t.id, admin);
    const formId = await createDraftForm({ templateId: t.id, performer: perf });
    const tasks = await getFormTasks(formId);
    // ONE instance per check — NOT duplicated per option.
    expect(tasks).toHaveLength(2);
    const bundle = await getFormBundle(formId);
    expect(bundle!.form.template_snapshot.uses_stages).toBe(true);
    expect(bundle!.form.template_snapshot.stages?.map((s) => s.name)).toEqual(['לפני הכנה', 'אחרי הכנה']);
    expect(bundle!.form.phase_id).toBeNull();
  });

  it('selecting a phase stores the id + the frozen name; it is single-select (replaces)', async () => {
    const t = await twoCheckTemplate();
    await setUsesStages(t.id, true);
    await renameStage(t.id, 'stage_1', 'לפני הכנה');
    await renameStage(t.id, 'stage_2', 'אחרי הכנה');
    await publishTemplate(t.id, admin);
    const formId = await createDraftForm({ templateId: t.id, performer: perf });
    await setFormPhase(formId, perf.id, 'stage_1');
    let b = await getFormBundle(formId);
    expect(b!.form.phase_id).toBe('stage_1');
    expect(b!.form.phase_name_snapshot).toBe('לפני הכנה');
    // Change choice → replaces (single-select).
    await setFormPhase(formId, perf.id, 'stage_2');
    b = await getFormBundle(formId);
    expect(b!.form.phase_id).toBe('stage_2');
    expect(b!.form.phase_name_snapshot).toBe('אחרי הכנה');
  });

  it('a phase must be chosen before submit', async () => {
    const t = await twoCheckTemplate();
    await setUsesStages(t.id, true);
    await publishTemplate(t.id, admin);
    const formId = await createDraftForm({ templateId: t.id, performer: perf });
    const v1 = await validateForSubmit(formId);
    expect(v1.errors.some((e) => e.includes('שלב בד״ח'))).toBe(true);
    await setFormPhase(formId, perf.id, 'stage_1');
    const v2 = await validateForSubmit(formId);
    expect(v2.errors.some((e) => e.includes('שלב בד״ח'))).toBe(false);
  });

  it('the chosen name is frozen — renaming the option later never changes the archived בד״ח', async () => {
    const t = await twoCheckTemplate();
    await setUsesStages(t.id, true);
    await renameStage(t.id, 'stage_1', 'לפני הכנה');
    await publishTemplate(t.id, admin);
    const formId = await createDraftForm({ templateId: t.id, performer: perf });
    await setFormPhase(formId, perf.id, 'stage_1');
    // Admin later renames the option and republishes.
    await renameStage(t.id, 'stage_1', 'לפני הפעלה');
    await publishTemplate(t.id, admin);
    const b = await getFormBundle(formId);
    expect(b!.form.phase_name_snapshot).toBe('לפני הכנה'); // frozen, not retroactive
  });

  it('a third option can be added and an option removed without breaking data', async () => {
    const t = await twoCheckTemplate();
    await setUsesStages(t.id, true);
    const s3 = await addStage(t.id, 'לפני משימה');
    expect(s3.id).toBe('stage_3');
    await removeStage(t.id, 'stage_2');
    expect((await getStages(t.id)).map((s) => s.id)).toEqual(['stage_1', 'stage_3']);
  });

  it('phase off = classic flat בד״ח, no phase required', async () => {
    const t = await twoCheckTemplate();
    const formId = await createDraftForm({ templateId: t.id, performer: perf });
    const b = await getFormBundle(formId);
    expect(b!.form.template_snapshot.uses_stages).toBeFalsy();
    const v = await validateForSubmit(formId);
    expect(v.errors.some((e) => e.includes('שלב בד״ח'))).toBe(false);
  });
});
