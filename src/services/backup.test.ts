import { beforeEach, describe, expect, it } from 'vitest';
import { createDraftForm, getFormTasks, listAllForms } from './forms';
import { addTask, createTemplate } from './templates';
import {
  exportFormsBundle,
  exportFullBackup,
  mergeFormsBundle,
  restoreFullBackup,
} from './backup';
import { db } from '@/data/db';
import { RoleName, type UserWithRoles } from '@/types';
import { ensureRoles, makeUser, resetDb } from '@/test/helpers';

describe('backup & file-based sync', () => {
  let performer: UserWithRoles;
  let admin: UserWithRoles;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    performer = await makeUser('perf', 'מבצע', [RoleName.PERFORMER]);
    admin = await makeUser('admin', 'מנהל', [RoleName.ADMIN]);
  });

  async function makeForm(name: string): Promise<string> {
    const t = await createTemplate({ name });
    await addTask(t.id, { part_name: 'חלק', action: 'פעולה', equipment: '' });
    return createDraftForm({ templateId: t.id, performer });
  }

  it('merges a forms bundle append-only, skipping existing ids', async () => {
    const id1 = await makeForm('בד״ח 1');
    const bundle = await exportFormsBundle();
    expect(bundle.forms).toHaveLength(1);

    // Simulate the master device: clear forms, then merge twice.
    const tasksBefore = await getFormTasks(id1);
    expect(tasksBefore.length).toBe(1);

    const first = await mergeFormsBundle(bundle);
    expect(first.added).toBe(0); // already present on this device
    expect(first.skipped).toBe(1);

    // Wipe local forms and merge fresh → should add.
    await db.completed_forms.clear();
    await db.completed_tasks.clear();
    const second = await mergeFormsBundle(bundle);
    expect(second.added).toBe(1);
    const forms = await listAllForms();
    expect(forms).toHaveLength(1);
    // Merging again is idempotent.
    const third = await mergeFormsBundle(bundle);
    expect(third.added).toBe(0);
  });

  it('full backup + restore round-trips all data', async () => {
    await makeForm('בד״ח א');
    await makeForm('בד״ח ב');
    const backup = await exportFullBackup();
    expect(backup.data.completed_forms).toHaveLength(2);

    await resetDb();
    expect(await listAllForms()).toHaveLength(0);

    const res = await restoreFullBackup(backup, admin);
    expect(res.formsRestored).toBe(2);
    expect(await listAllForms()).toHaveLength(2);
    // Users restored too.
    expect(await db.users.count()).toBe(backup.data.users.length);
  });
});
