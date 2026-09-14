import { beforeEach, describe, expect, it } from 'vitest';
import {
  createPerformer,
  getPerformer,
  listActivePerformers,
  listPerformers,
  setPerformerActive,
  updatePerformer,
} from './performers';
import { createDraftForm, getForm, updateFormMeta } from './forms';
import { addTask, createTemplate } from './templates';
import { RoleName, type UserWithRoles } from '@/types';
import { ensureRoles, makeUser, resetDb } from '@/test/helpers';

describe('performers directory (מבצע 2)', () => {
  let performer: UserWithRoles;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    performer = await makeUser('perf', 'ישראל ישראלי', [RoleName.PERFORMER]);
  });

  it('creates performers and lists only active ones for new forms', async () => {
    const a = await createPerformer('דני כהן');
    const b = await createPerformer('יוסי לוי');
    await setPerformerActive(b.id, false);

    const all = await listPerformers(true);
    expect(all).toHaveLength(2);

    const active = await listActivePerformers();
    expect(active.map((p) => p.id)).toEqual([a.id]);
  });

  it('editing full_name updates the directory entry', async () => {
    const p = await createPerformer('דוד אברהם');
    await updatePerformer(p.id, { full_name: 'דוד אברהמי' });
    expect((await getPerformer(p.id))!.full_name).toBe('דוד אברהמי');
  });

  it('preserves history: disabling a performer never changes past forms', async () => {
    const p = await createPerformer('משה כהן');
    const t = await createTemplate({ name: 'בדיקה יומית' });
    await addTask(t.id, { part_name: 'מנוע', action: 'שמן', equipment: 'כפפות' });
    const formId = await createDraftForm({ templateId: t.id, performer });

    // Select performer 2 — both id and a name snapshot are stored.
    await updateFormMeta(formId, performer.id, {
      performer2_id: p.id,
      performer2_name: p.full_name,
    });

    // Admin later disables (and even renames) that person.
    await updatePerformer(p.id, { full_name: 'שם חדש', active: false });

    const form = await getForm(formId);
    expect(form!.performer2_id).toBe(p.id); // link preserved
    expect(form!.performer2_name).toBe('משה כהן'); // snapshot frozen at inspection time
  });
});
