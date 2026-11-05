import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, ensureRoles, makeUser, certifyAllSystems } from '@/test/helpers';
import { db } from '@/data/db';
import { nowIso } from './ids';
import { createTemplate, addTask } from './templates';
import { createDraftForm, getFormBundle } from './forms';
import {
  defineFromFault, listActiveForUnit, snapshotForUnit, closeTracking, keepInTracking,
  listAllTrackingFaults, setTrackingRepairStatus,
} from './trackingFaults';
import { RoleName, TaskResult, type CompletedForm, type CompletedTask, type UserWithRoles } from '@/types';

function fakeForm(unitId: string, over: Partial<CompletedForm> = {}): CompletedForm {
  const now = nowIso();
  return {
    id: 'form1', device_id: 'dev1', template_id: 't1', template_snapshot: { template_id: 't1', template_name: 'x', description: '', tasks: [], snapshot_at: now },
    system_id: 'sysA', system_name_snapshot: 'מערכת X', unit_id: unitId, unit_name_snapshot: '15482',
    rank_id: 'rankA', rank_name_snapshot: 'דרג א׳', template_name_snapshot: 'בד״ח', template_version_snapshot: 1,
    name: 'בד״ח', number: '000125', performer_user_id: 'p1', performer_name: 'מבצע', performer2_id: null, performer2_name: '',
    approver_user_id: null, approver_name: null, date: now.slice(0, 10), status: 'DRAFT' as never,
    created_at: now, completed_at: null, approved_at: null, ...over,
  } as CompletedForm;
}
function faultTask(over: Partial<CompletedTask> = {}): CompletedTask {
  return {
    id: 'task1', completed_form_id: 'form1', part_name_snapshot: 'אזור חיבור', action_snapshot: 'בדיקה ויזואלית',
    equipment_snapshot: '', image_snapshot: null, result: TaskResult.FAULT, comment: 'נזילה באזור החיבור', fault_image: null, sort_order: 0,
    fault_reported_by_id: 'p1', fault_reported_by_name: 'מבצע', ...over,
  } as CompletedTask;
}

describe('tracking faults (תקלה במעקב)', () => {
  let approver: UserWithRoles;
  let performer: UserWithRoles;

  beforeEach(async () => {
    await resetDb();
    await ensureRoles();
    approver = await makeUser('appr', 'מאשר', [RoleName.APPROVER]);
    performer = await makeUser('perf', 'מבצע', [RoleName.PERFORMER]);
  });

  it('default: a unit has NO tracking faults until one is explicitly defined', async () => {
    expect(await listActiveForUnit('15482')).toHaveLength(0);
    expect(await snapshotForUnit('15482')).toHaveLength(0);
  });

  it('only an approver can define; a performer cannot', async () => {
    const form = fakeForm('15482');
    await expect(defineFromFault({ form, task: faultTask(), actor: performer })).rejects.toThrow(/הרשאת אישור/);
    const tf = await defineFromFault({ form, task: faultTask(), actor: approver });
    expect(tf.tracking_status).toBe('active');
    expect(tf.unit_id).toBe('15482');
    expect(tf.description).toBe('נזילה באזור החיבור');
    expect(tf.source_rank_name).toBe('דרג א׳');
    expect(tf.events.map((e) => e.kind)).toEqual(['opened', 'defined']);
  });

  it('is idempotent per (form, source task)', async () => {
    const form = fakeForm('15482');
    const a = await defineFromFault({ form, task: faultTask(), actor: approver });
    const b = await defineFromFault({ form, task: faultTask(), actor: approver });
    expect(a.id).toBe(b.id);
    expect(await listAllTrackingFaults()).toHaveLength(1);
  });

  it('repair / repair-approval does NOT auto-close the tracking', async () => {
    const form = fakeForm('15482');
    const tf = await defineFromFault({ form, task: faultTask(), actor: approver });
    await setTrackingRepairStatus(tf.id, 'repaired', approver);
    await setTrackingRepairStatus(tf.id, 'repair_approved', approver);
    const active = await listActiveForUnit('15482');
    expect(active).toHaveLength(1); // still active
    expect(active[0].repair_status).toBe('repair_approved');
    expect(active[0].tracking_status).toBe('active');
  });

  it('only an approver can close; closing stores who/when/note and keeps the timeline', async () => {
    const form = fakeForm('15482');
    const tf = await defineFromFault({ form, task: faultTask(), actor: approver });
    await expect(closeTracking(tf.id, performer, {})).rejects.toThrow(/הרשאה/);
    await keepInTracking(tf.id, approver, 'נבדק — להמשיך מעקב');
    await closeTracking(tf.id, approver, { note: 'תוקן ואומת — סגירה', signature: 'data:sig', role: 'מאשר' });
    expect(await listActiveForUnit('15482')).toHaveLength(0); // no longer active
    const closed = (await listAllTrackingFaults())[0];
    expect(closed.tracking_status).toBe('closed');
    expect(closed.closed_by_name).toBe('מאשר');
    expect(closed.close_note).toBe('תוקן ואומת — סגירה');
    expect(closed.events.map((e) => e.kind)).toEqual(['opened', 'defined', 'kept', 'closed']); // full history
  });

  it('a new בד״ח freezes the active tracking faults; after close it no longer appears, old form unchanged', async () => {
    const t = await createTemplate({ name: 'בד״ח יומי' });
    await addTask(t.id, { part_name: 'מנוע', action: 'בדיקה', equipment: '' });
    await certifyAllSystems(performer.id);
    const now = nowIso();
    const unit = { id: 'u15482', system_id: t.system_id, name: '15482', active: true, sort_order: 0, created_at: now, updated_at: now };
    await db.units.add(unit as never);

    // Define a tracking fault for that unit.
    await defineFromFault({ form: fakeForm('u15482', { system_id: t.system_id }), task: faultTask(), actor: approver });

    // A new בד״ח for the unit freezes it.
    const form1 = await createDraftForm({ templateId: t.id, performer, unitId: 'u15482' });
    const b1 = await getFormBundle(form1);
    expect(b1!.form.tracking_faults_snapshot).toHaveLength(1);
    expect(b1!.form.tracking_faults_snapshot![0].description).toBe('נזילה באזור החיבור');

    // Close the tracking, then a NEW form has an empty snapshot…
    const tf = (await listActiveForUnit('u15482'))[0];
    await closeTracking(tf.id, approver, { note: 'נסגר' });
    const form2 = await createDraftForm({ templateId: t.id, performer, unitId: 'u15482' });
    expect((await getFormBundle(form2))!.form.tracking_faults_snapshot).toHaveLength(0);
    // …while the EARLIER form still shows it was active at its execution time.
    expect((await getFormBundle(form1))!.form.tracking_faults_snapshot).toHaveLength(1);
  });

  it('tracking follows the unit across ranks (snapshot is by unit, not rank)', async () => {
    const form = fakeForm('15482', { rank_name_snapshot: 'דרג א׳' });
    await defineFromFault({ form, task: faultTask(), actor: approver });
    // snapshotForUnit does not depend on rank — any later בד״ח of the unit sees it.
    const snap = await snapshotForUnit('15482');
    expect(snap).toHaveLength(1);
    expect(snap[0].source_rank_name).toBe('דרג א׳');
  });
});
