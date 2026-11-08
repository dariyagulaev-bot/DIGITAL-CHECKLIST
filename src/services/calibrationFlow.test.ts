import { beforeEach, describe, expect, it } from 'vitest';
import { createDraftForm, getFormTasks, setTaskResult, validateForSubmit } from './forms';
import { addTask, createTemplate } from './templates';
import { setCalibrationPolicy } from './settings';
import { taskHasExpiredCalibration, calibrationState } from './calibration';
import { TaskResult, type UserWithRoles } from '@/types';
import { ensureRoles, makeUser, resetDb, certifyAllSystems } from '@/test/helpers';
import { RoleName } from '@/types';

async function setup() {
  const template = await createTemplate({ name: 'בדיקה עם כיול' });
  // One item needs no calibration, one needs calibration with an EXPIRED date.
  await addTask(template.id, {
    part_name: 'מנוע',
    action: 'בדיקת לחץ',
    equipment_items: ['מברג', 'מד לחץ'],
    equipment_calibration: [
      null,
      { requires_calibration: true, serial_number: '45821', calibration_expiry: '2020-01-01' },
    ],
  });
  return template;
}

describe('equipment calibration — snapshot + policy', () => {
  let performer: UserWithRoles;
  let template: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    performer = await makeUser('perf', 'מבצע', [RoleName.PERFORMER], 'pw');
    template = await setup(); // creates its own system/rank
    await certifyAllSystems(performer.id); // certify AFTER the system exists
  });

  it('freezes per-item calibration onto the completed task (aligned with items)', async () => {
    const formId = await createDraftForm({ templateId: template.id, performer });
    const tasks = await getFormTasks(formId);
    const t = tasks.find((x) => x.part_name_snapshot === 'מנוע')!;
    expect(t.equipment_items_snapshot).toEqual(['מברג', 'מד לחץ']);
    expect(t.equipment_calibration_snapshot?.[0]).toBeNull();
    expect(t.equipment_calibration_snapshot?.[1]?.serial_number).toBe('45821');
    expect(t.equipment_calibration_snapshot?.[1]?.calibration_expiry).toBe('2020-01-01');
  });

  it('detects the expired calibration as of the form date', async () => {
    const formId = await createDraftForm({ templateId: template.id, performer });
    const [t] = await getFormTasks(formId);
    expect(calibrationState('2020-01-01', '2026-11-08')).toBe('expired');
    expect(taskHasExpiredCalibration(t, '2026-11-08')).toBe(true);
  });

  it('"block" policy adds a submit error for expired-calibration equipment; "warn" does not', async () => {
    const formId = await createDraftForm({ templateId: template.id, performer });
    const [t] = await getFormTasks(formId);
    await setTaskResult(formId, performer.id, t.id, TaskResult.OK);

    await setCalibrationPolicy('block');
    const blocked = await validateForSubmit(formId);
    expect(blocked.errors.some((e) => e.includes('פג תוקף הכיול'))).toBe(true);

    await setCalibrationPolicy('warn');
    const warned = await validateForSubmit(formId);
    expect(warned.errors.some((e) => e.includes('פג תוקף הכיול'))).toBe(false);
  });
});
