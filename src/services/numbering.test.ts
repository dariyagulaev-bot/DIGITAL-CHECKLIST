import { beforeEach, describe, expect, it } from 'vitest';
import { createDraftForm, getForm, deleteDraft, buildBadachNumber } from './forms';
import { createTemplate } from './templates';
import { createSystem } from './systems';
import { createUnit } from './units';
import { RoleName, type UserWithRoles } from '@/types';
import { ensureRoles, makeUser, resetDb } from '@/test/helpers';

describe('automatic running בד״ח number', () => {
  let performer: UserWithRoles;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    performer = await makeUser('perf', 'ישראל ישראלי', [RoleName.PERFORMER]);
  });

  it('formats as [system]-[unit]-[6 digits] with leading zeros', () => {
    expect(buildBadachNumber('מערכת ב׳', '02', 1)).toBe('מערכת ב׳-02-000001');
    expect(buildBadachNumber('מערכת ב׳', '02', 26)).toBe('מערכת ב׳-02-000026');
    expect(buildBadachNumber('מערכת א׳', '', 3)).toBe('מערכת א׳-000003');
  });

  it('increments per physical unit, independently', async () => {
    const sys = await createSystem('מערכת ב׳');
    const u02 = await createUnit(sys.id, '02');
    const u03 = await createUnit(sys.id, '03');
    const t = await createTemplate({ name: 'בדיקה', system_id: sys.id });

    const f1 = await createDraftForm({ templateId: t.id, performer, unitId: u02.id });
    const f2 = await createDraftForm({ templateId: t.id, performer, unitId: u02.id });
    const g1 = await createDraftForm({ templateId: t.id, performer, unitId: u03.id });

    expect((await getForm(f1))!.number).toBe('מערכת ב׳-02-000001');
    expect((await getForm(f2))!.number).toBe('מערכת ב׳-02-000002');
    // Unit 03 has its own counter, starting fresh.
    expect((await getForm(g1))!.number).toBe('מערכת ב׳-03-000001');
  });

  it('never reuses a number, even after a form is deleted', async () => {
    const sys = await createSystem('מערכת ב׳');
    const u02 = await createUnit(sys.id, '02');
    const t = await createTemplate({ name: 'בדיקה', system_id: sys.id });

    const f1 = await createDraftForm({ templateId: t.id, performer, unitId: u02.id });
    const f2 = await createDraftForm({ templateId: t.id, performer, unitId: u02.id });
    expect((await getForm(f2))!.number).toBe('מערכת ב׳-02-000002');

    await deleteDraft(f2, performer.id); // delete #000002
    const f3 = await createDraftForm({ templateId: t.id, performer, unitId: u02.id });
    // The next number continues forward — no reuse of 000002.
    expect((await getForm(f3))!.number).toBe('מערכת ב׳-02-000003');
    expect((await getForm(f1))!.number).toBe('מערכת ב׳-02-000001');
  });

  it('assigns the number once and keeps it stable', async () => {
    const sys = await createSystem('מערכת ב׳');
    const u02 = await createUnit(sys.id, '02');
    const t = await createTemplate({ name: 'בדיקה', system_id: sys.id });
    const id = await createDraftForm({ templateId: t.id, performer, unitId: u02.id });
    const num = (await getForm(id))!.number;
    // Re-reading the record yields the same number (never regenerated).
    expect((await getForm(id))!.number).toBe(num);
    expect(num).toBe('מערכת ב׳-02-000001');
  });
});
