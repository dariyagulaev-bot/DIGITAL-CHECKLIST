import { beforeEach, describe, expect, it } from 'vitest';
import { createSystem } from './systems';
import { createUnit, listUnitsBySystem } from './units';
import { createRank } from './ranks';
import { createTemplate, listTemplatesBy } from './templates';
import { createDraftForm, getDashboardBreakdowns, getForm } from './forms';
import { RoleName, type UserWithRoles } from '@/types';
import { ensureRoles, makeUser, resetDb } from '@/test/helpers';

describe('dynamic hierarchy: system → unit → rank → template', () => {
  let performer: UserWithRoles;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    performer = await makeUser('perf', 'ישראל ישראלי', [RoleName.PERFORMER]);
  });

  it('associates a template with a system + rank and filters by both', async () => {
    const sys = await createSystem('מערכת א׳');
    const rankA = await createRank('דרג א׳');
    const rankB = await createRank('דרג ב׳');

    const tA = await createTemplate({ name: 'בד״ח א', system_id: sys.id, rank_id: rankA.id });
    await createTemplate({ name: 'בד״ח ב', system_id: sys.id, rank_id: rankB.id });

    const forRankA = await listTemplatesBy(sys.id, rankA.id, true);
    expect(forRankA.map((t) => t.id)).toEqual([tA.id]);
  });

  it('an explicit null rank means the template applies to all ranks', async () => {
    const sys = await createSystem('מערכת א׳');
    const t = await createTemplate({ name: 'כללי', system_id: sys.id, rank_id: null });
    expect(t.rank_id).toBeNull();
  });

  it('a draft form freezes the full hierarchy snapshot', async () => {
    const sys = await createSystem('מערכת רדאר');
    const unit = await createUnit(sys.id, 'A-07');
    const rank = await createRank('דרג ג׳');
    const tpl = await createTemplate({ name: 'בדיקה שבועית', system_id: sys.id, rank_id: rank.id });

    const formId = await createDraftForm({ templateId: tpl.id, performer, unitId: unit.id });
    const form = await getForm(formId);
    expect(form!.system_name_snapshot).toBe('מערכת רדאר');
    expect(form!.unit_name_snapshot).toBe('A-07');
    expect(form!.rank_name_snapshot).toBe('דרג ג׳');
    expect(form!.template_name_snapshot).toBe('בדיקה שבועית');
    expect(form!.template_version_snapshot).toBe(1);
  });

  it('units are scoped to their system type', async () => {
    const s1 = await createSystem('מערכת 1');
    const s2 = await createSystem('מערכת 2');
    await createUnit(s1.id, 'U1');
    await createUnit(s2.id, 'U2');
    const u1 = await listUnitsBySystem(s1.id, true);
    expect(u1).toHaveLength(1);
    expect(u1[0].name).toBe('U1');
  });

  it('dashboard breakdowns aggregate forms by system snapshot', async () => {
    const sys = await createSystem('מערכת סטטיסטיקה');
    const rank = await createRank('דרג א׳');
    const tpl = await createTemplate({ name: 'בד״ח', system_id: sys.id, rank_id: rank.id });
    await createDraftForm({ templateId: tpl.id, performer });
    await createDraftForm({ templateId: tpl.id, performer });

    const b = await getDashboardBreakdowns();
    expect(b.totalForms).toBe(2);
    const row = b.bySystem.find((r) => r.label === 'מערכת סטטיסטיקה');
    expect(row?.total).toBe(2);
  });
});
