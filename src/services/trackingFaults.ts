import { db } from '@/data/db';
import { newId, nowIso, getDeviceId } from './ids';
import { logAudit } from './audit';
import { canApprove, isAdmin } from './rbac';
import type {
  CompletedForm,
  CompletedTask,
  TrackingEvent,
  TrackingEventKind,
  TrackingFault,
  TrackingFaultSnapshot,
  TrackingRepairStatus,
  UserWithRoles,
} from '@/types';

/**
 * TRACKING FAULTS (תקלה במעקב) — a SEPARATE layer over the normal fault/repair
 * pipeline. Nothing here runs automatically: a tracking fault exists only after
 * an explicit, authorized "הגדר כתקלה במעקב". It is tied to the unit
 * (מספר מערכת) and keeps surfacing on that unit's future בד״חים — across ranks —
 * until an authorized approver closes it, even after the fault is repaired and
 * the repair approved. The existing fault mechanism is untouched.
 */

/** Only an approver (or admin) may define / close / keep a tracking fault. */
export function canManageTracking(user: UserWithRoles | null): boolean {
  return canApprove(user) || isAdmin(user);
}

const evt = (kind: TrackingEventKind, actor: { id: string; full_name: string; role?: string }, note?: string): TrackingEvent => ({
  id: newId(),
  at: nowIso(),
  kind,
  actor_id: actor.id,
  actor_name: actor.full_name,
  actor_role: actor.role,
  note: note?.trim() || undefined,
});

/** Repair state of the underlying fault, derived from its lifecycle flags. */
function repairStatusOf(task?: CompletedTask | null): TrackingRepairStatus {
  if (!task) return 'not_repaired';
  if (task.verified) return 'repair_approved';
  if (task.repair_reported || task.repair_done) return 'repaired';
  return 'not_repaired';
}

// ===== create =============================================================

/**
 * Define an existing fault (a CompletedTask marked לא תקין, or a free-form fault)
 * as a tracking fault for the form's unit. Idempotent per (form, source task):
 * calling it again returns the existing record. Authorized users only.
 */
export async function defineFromFault(params: {
  form: CompletedForm;
  task?: CompletedTask | null;
  actor: UserWithRoles;
  description?: string;
  note?: string;
}): Promise<TrackingFault> {
  const { form, task, actor } = params;
  if (!canManageTracking(actor)) throw new Error('רק בעל הרשאת אישור יכול להגדיר תקלה במעקב.');

  // Avoid duplicates for the same source section of the same בד״ח.
  if (task) {
    const existing = (await db.tracking_faults.where('source_form_id').equals(form.id).toArray()).find(
      (t) => t.source_task_id === task.id
    );
    if (existing) return existing;
  }

  const now = nowIso();
  const images = [task?.fault_image, task?.repair_image].filter((x): x is string => !!x);
  const description =
    params.description?.trim() ||
    task?.comment?.trim() ||
    (task ? `${task.part_name_snapshot} — ${task.action_snapshot}` : 'תקלה במעקב');

  const tf: TrackingFault = {
    id: newId(),
    device_id: getDeviceId(),
    system_id: form.system_id,
    system_name: form.system_name_snapshot,
    unit_id: form.unit_id,
    unit_name: form.unit_name_snapshot,
    source_form_id: form.id,
    source_form_number: form.number,
    source_rank_id: form.rank_id,
    source_rank_name: form.rank_name_snapshot,
    source_task_id: task?.id,
    description,
    notes: params.note?.trim() || undefined,
    images: images.length ? images : undefined,
    reported_by_id: task?.fault_reported_by_id,
    reported_by_name: task?.fault_reported_by_name || form.performer_name,
    defined_by_id: actor.id,
    defined_by_name: actor.full_name,
    opened_at: now,
    repair_status: repairStatusOf(task),
    tracking_status: 'active',
    events: [],
    created_at: now,
    updated_at: now,
  };
  // Timeline: discovery → defined (and the current repair state, when relevant).
  tf.events.push(evt('opened', { id: tf.reported_by_id ?? actor.id, full_name: tf.reported_by_name ?? actor.full_name }, 'התקלה התגלתה'));
  tf.events.push(evt('defined', actor, 'הוגדרה כתקלה במעקב'));
  if (tf.repair_status === 'repaired') tf.events.push(evt('repair_reported', actor));
  if (tf.repair_status === 'repair_approved') tf.events.push(evt('repair_approved', actor));

  await db.tracking_faults.add(tf);
  await logAudit({
    user_id: actor.id,
    user_name: actor.full_name,
    action: 'TRACKING_FAULT_DEFINE',
    entity_type: 'tracking_fault',
    entity_id: tf.id,
    field: form.unit_name_snapshot,
    new_value: description,
  });
  return tf;
}

// ===== queries ============================================================

/** Active tracking faults for a unit (מספר מערכת), newest first. */
export async function listActiveForUnit(unitId: string | null): Promise<TrackingFault[]> {
  if (!unitId) return [];
  const rows = await db.tracking_faults.where('unit_id').equals(unitId).toArray();
  return rows.filter((t) => t.tracking_status === 'active').sort((a, b) => b.opened_at.localeCompare(a.opened_at));
}

/** A frozen snapshot of the active tracking faults for a unit (for the form). */
export async function snapshotForUnit(unitId: string | null): Promise<TrackingFaultSnapshot[]> {
  const active = await listActiveForUnit(unitId);
  return active.map((t) => ({
    id: t.id,
    description: t.description,
    source_form_number: t.source_form_number,
    source_rank_name: t.source_rank_name,
    opened_at: t.opened_at,
    repair_status: t.repair_status,
  }));
}

export async function getTrackingFault(id: string): Promise<TrackingFault | undefined> {
  return db.tracking_faults.get(id);
}

export async function listAllTrackingFaults(): Promise<TrackingFault[]> {
  return (await db.tracking_faults.toArray()).sort((a, b) => b.opened_at.localeCompare(a.opened_at));
}

// ===== mutations ==========================================================

async function patch(id: string, p: Partial<TrackingFault>, event?: TrackingEvent): Promise<TrackingFault> {
  const t = await db.tracking_faults.get(id);
  if (!t) throw new Error('תקלת המעקב לא נמצאה.');
  const next: TrackingFault = { ...t, ...p, updated_at: nowIso(), events: event ? [...t.events, event] : t.events };
  await db.tracking_faults.put(next);
  return next;
}

/** Record that the underlying fault was repaired / its repair approved. Never
 * closes the tracking — that is an explicit approver decision. */
export async function setTrackingRepairStatus(id: string, status: TrackingRepairStatus, actor: UserWithRoles): Promise<void> {
  const t = await db.tracking_faults.get(id);
  if (!t || t.repair_status === status) return;
  const kind: TrackingEventKind = status === 'repair_approved' ? 'repair_approved' : status === 'repaired' ? 'repair_reported' : 'note';
  await patch(id, { repair_status: status }, evt(kind, actor));
}

/** Re-examined on a later בד״ח (keeps the tracking active, logs the recheck). */
export async function recordRecheck(id: string, actor: UserWithRoles, note?: string): Promise<void> {
  await patch(id, {}, evt('rechecked', actor, note));
  await logAudit({ user_id: actor.id, user_name: actor.full_name, action: 'TRACKING_FAULT_RECHECK', entity_type: 'tracking_fault', entity_id: id, new_value: note });
}

/** Approver decides to KEEP tracking (with an optional note). Active stays active. */
export async function keepInTracking(id: string, approver: UserWithRoles, note?: string, role?: string): Promise<void> {
  if (!canManageTracking(approver)) throw new Error('אין לך הרשאה לנהל תקלות במעקב.');
  await patch(id, {}, evt('kept', { ...approver, role }, note || 'נבדק — להמשיך מעקב'));
  await logAudit({ user_id: approver.id, user_name: approver.full_name, action: 'TRACKING_FAULT_KEEP', entity_type: 'tracking_fault', entity_id: id, new_value: note });
}

/** CLOSE the tracking. Authorized approver only. Stores who/role/when + note +
 * signature; the record (and its full timeline) is kept forever. */
export async function closeTracking(
  id: string,
  approver: UserWithRoles,
  opts: { note?: string; signature?: string | null; role?: string }
): Promise<void> {
  if (!canManageTracking(approver)) throw new Error('רק מאשר בעל הרשאה יכול לסגור מעקב.');
  const t = await db.tracking_faults.get(id);
  if (!t) throw new Error('תקלת המעקב לא נמצאה.');
  if (t.tracking_status === 'closed') return; // idempotent
  const now = nowIso();
  await patch(
    id,
    {
      tracking_status: 'closed',
      closed_by_id: approver.id,
      closed_by_name: approver.full_name,
      closed_by_role: opts.role,
      closed_at: now,
      close_note: opts.note?.trim() || undefined,
      close_signature: opts.signature ?? null,
    },
    evt('closed', { ...approver, role: opts.role }, opts.note || 'המעקב נסגר')
  );
  await logAudit({ user_id: approver.id, user_name: approver.full_name, action: 'TRACKING_FAULT_CLOSE', entity_type: 'tracking_fault', entity_id: id, field: t.unit_name, new_value: opts.note });
}
