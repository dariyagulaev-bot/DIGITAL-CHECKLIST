import { beforeEach, describe, expect, it } from 'vitest';
import { createSystem, updateSystem, listSystems } from './systems';
import { createTemplate, addTask } from './templates';
import { createDraftForm, getForm } from './forms';
import { RoleName, type UserWithRoles } from '@/types';
import { ensureRoles, makeUser, resetDb } from '@/test/helpers';

describe('systems (מערכות)', () => {
  let performer: UserWithRoles;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    performer = await makeUser('perf', 'מבצע', [RoleName.PERFORMER]);
  });

  it('associates a template with a system and snapshots the system name on a form', async () => {
    const sys = await createSystem('מערכת א׳');
    const t = await createTemplate({ name: 'בד״ח יומי', system_id: sys.id });
    await addTask(t.id, { part_name: 'אזור', action: 'בדיקה', equipment: '' });

    const formId = await createDraftForm({ templateId: t.id, performer });
    const form = await getForm(formId);
    expect(form!.system_id).toBe(sys.id);
    expect(form!.system_name_snapshot).toBe('מערכת א׳');
  });

  it('renaming a system does not change the name on forms already performed', async () => {
    const sys = await createSystem('מערכת א׳');
    const t = await createTemplate({ name: 'בד״ח יומי', system_id: sys.id });
    await addTask(t.id, { part_name: 'אזור', action: 'בדיקה', equipment: '' });
    const formId = await createDraftForm({ templateId: t.id, performer });

    await updateSystem(sys.id, { name: 'מערכת מעודכנת' });

    const form = await getForm(formId);
    expect(form!.system_name_snapshot).toBe('מערכת א׳'); // frozen at creation
    const systems = await listSystems(true);
    expect(systems.find((s) => s.id === sys.id)!.name).toBe('מערכת מעודכנת');
  });

  it('createTemplate auto-assigns a default system when none is given', async () => {
    const t = await createTemplate({ name: 'ללא מערכת מפורשת' });
    expect(t.system_id).toBeTruthy();
    const systems = await listSystems(true);
    expect(systems.some((s) => s.id === t.system_id)).toBe(true);
  });
});
