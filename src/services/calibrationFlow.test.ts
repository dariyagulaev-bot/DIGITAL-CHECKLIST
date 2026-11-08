import { beforeEach, describe, expect, it } from 'vitest';
import { createDraftForm, getFormTasks, setTaskResult, setTaskCalibration, validateForSubmit } from './forms';
import { addTask, createTemplate } from './templates';
import { setCalibrationPolicy } from './settings';
import { TaskResult, RoleName, type UserWithRoles } from '@/types';
import { ensureRoles, makeUser, resetDb, certifyAllSystems } from '@/test/helpers';

async function setup() {
  const template = await createTemplate({ name: 'בדיקה עם כיול' });
  // Admin flags only WHICH item requires calibration (no serial/expiry).
  await addTask(template.id, {
    part_name: 'מנוע',
    action: 'בדיקת לחץ',
    equipment_items: ['מברג', 'מד לחץ'],
    equipment_calibration: [null, { requires_calibration: true }],
  });
  return template;
}

describe('equipment calibration — admin requirement + performer entry', () => {
  let performer: UserWithRoles;
  let template: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    performer = await makeUser('perf', 'מבצע', [RoleName.PERFORMER], 'pw');
    template = await setup();
    await certifyAllSystems(performer.id);
  });

  it('freezes only the ADMIN requirement onto the task (no serial/expiry)', async () => {
    const formId = await createDraftForm({ templateId: template.id, performer });
    const [t] = await getFormTasks(formId);
    expect(t.equipment_items_snapshot).toEqual(['מברג', 'מד לחץ']);
    expect(t.equipment_calibration_snapshot?.[0]).toBeNull();
    expect(t.equipment_calibration_snapshot?.[1]).toEqual({ requires_calibration: true });
    // No performer entry yet.
    expect(t.equipment_calibration_entries?.[1]?.serial_number ?? undefined).toBeUndefined();
  });

  it('stores the PERFORMER-entered serial/expiry with who + when', async () => {
    const formId = await createDraftForm({ templateId: template.id, performer });
    const [t0] = await getFormTasks(formId);
    await setTaskCalibration(formId, performer.id, t0.id, 1, { serial_number: '45821', calibration_expiry: '2027-03-15' });
    const [t] = await getFormTasks(formId);
    const e = t.equipment_calibration_entries?.[1];
    expect(e?.serial_number).toBe('45821');
    expect(e?.calibration_expiry).toBe('2027-03-15');
    expect(e?.entered_by_id).toBe(performer.id);
    expect(e?.entered_by_name).toBe('מבצע');
    expect(e?.entered_at).toBeTruthy();
  });

  it('rejects calibration data on an item that does not require it', async () => {
    const formId = await createDraftForm({ templateId: template.id, performer });
    const [t] = await getFormTasks(formId);
    await expect(
      setTaskCalibration(formId, performer.id, t.id, 0, { serial_number: 'x', calibration_expiry: '2027-01-01' })
    ).rejects.toThrow(/אינו דורש כיול/);
  });

  it('requires serial + expiry for every required item before submit', async () => {
    const formId = await createDraftForm({ templateId: template.id, performer });
    const [t] = await getFormTasks(formId);
    await setTaskResult(formId, performer.id, t.id, TaskResult.OK);

    const before = await validateForSubmit(formId);
    expect(before.errors.some((e) => e.includes('מספר סידורי ותוקף כיול'))).toBe(true);

    await setTaskCalibration(formId, performer.id, t.id, 1, { serial_number: '45821', calibration_expiry: '2027-03-15' });
    const after = await validateForSubmit(formId);
    expect(after.errors.some((e) => e.includes('מספר סידורי ותוקף כיול'))).toBe(false);
  });

  it('"block" policy blocks submit when the entered calibration is expired', async () => {
    const formId = await createDraftForm({ templateId: template.id, performer });
    const [t] = await getFormTasks(formId);
    await setTaskResult(formId, performer.id, t.id, TaskResult.OK);
    await setTaskCalibration(formId, performer.id, t.id, 1, { serial_number: '45821', calibration_expiry: '2020-01-01' });

    await setCalibrationPolicy('block');
    const blocked = await validateForSubmit(formId);
    expect(blocked.errors.some((e) => e.includes('פג תוקף הכיול'))).toBe(true);

    await setCalibrationPolicy('warn');
    const warned = await validateForSubmit(formId);
    expect(warned.errors.some((e) => e.includes('פג תוקף הכיול'))).toBe(false);
  });
});
