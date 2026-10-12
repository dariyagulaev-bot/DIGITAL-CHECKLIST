import { db } from '@/data/db';
import { newId, nowIso, getDeviceId } from './ids';
import { getTemplate, getTemplateTasks } from './templates';
import { getSystem } from './systems';
import { getUnit } from './units';
import { getRank } from './ranks';
import {
  FormStatus,
  SignerType,
  TaskResult,
  RoleName,
  DEFAULT_CLASSIFICATION,
  type CompletedForm,
  type CompletedTask,
  type FaultEvent,
  type Signature,
  type TemplateSnapshot,
  type UserWithRoles,
} from '@/types';
import { equipmentItemsOf } from '@/exports/labels';
import { isUserCertified } from './certifications';
import { getUserById, getUserRoles } from './auth';
import { getEffectiveBlocks } from './blocks';
import type {
  BlockSnapshot,
  CheckRefConfig,
  CompletedBlock,
  PublishedCheckConfig,
  TaskSnapshot,
} from '@/types';

/** Full aggregate for a form. */
export interface FormBundle {
  form: CompletedForm;
  tasks: CompletedTask[];
  blocks: CompletedBlock[];
  signatures: Signature[];
}

/**
 * A form is editable by the performer while it is a draft / in progress, or
 * after an approver returned it for correction (REJECTED).
 */
export function isEditableByPerformer(form: CompletedForm): boolean {
  return (
    form.status === FormStatus.DRAFT ||
    form.status === FormStatus.IN_PROGRESS ||
    form.status === FormStatus.REJECTED
  );
}

export function isLocked(form: CompletedForm): boolean {
  return form.status === FormStatus.APPROVED;
}

/** Zero-pad a serial to 6 digits (e.g. 26 → "000026"). */
function pad6(n: number): string {
  return String(n).padStart(6, '0');
}

/**
 * Atomically issue the next serial for a counter key (one counter per physical
 * unit). Monotonic — never reused, even if a form is later deleted.
 */
export async function nextSequence(key: string): Promise<number> {
  return db.transaction('rw', db.counters, async () => {
    const row = await db.counters.get(key);
    const next = (row?.value ?? 0) + 1;
    await db.counters.put({ id: key, value: next });
    return next;
  });
}

/** Build the running בד״ח number: [system]-[unit]-[000001] (unit optional). */
export function buildBadachNumber(systemName: string, unitName: string, serial: number): string {
  const prefix = [systemName, unitName].filter((s) => s && s.trim()).join('-');
  return prefix ? `${prefix}-${pad6(serial)}` : pad6(serial);
}

/** Create a new draft form: freezes a snapshot of the template + hierarchy. */
export async function createDraftForm(params: {
  templateId: string;
  performer: UserWithRoles;
  unitId?: string;
  name?: string;
  date?: string;
}): Promise<string> {
  const template = await getTemplate(params.templateId);
  if (!template) throw new Error('התבנית לא נמצאה');
  // Enforce certification (business layer, not only the wizard UI): the
  // performer must be certified for this system up to at least this rank.
  // Admins are superusers and exempt. A later certification change never
  // touches this form — its context is snapshotted below.
  if (!params.performer.roles.includes(RoleName.ADMIN)) {
    const ok = await isUserCertified(
      params.performer.id,
      template.system_id ?? null,
      template.rank_id ?? null
    );
    if (!ok) throw new Error('אינך מוסמך למערכת ולדרג של בד״ח זה.');
  }
  const system = template.system_id ? await getSystem(template.system_id) : undefined;
  const unit = params.unitId ? await getUnit(params.unitId) : undefined;
  const rank = template.rank_id ? await getRank(template.rank_id) : undefined;

  // Mint the running בד״ח number ONCE, at creation. Numbering advances per
  // physical unit (or per system when the form has no unit).
  const counterKey = params.unitId ?? template.system_id ?? 'GLOBAL';
  const serial = await nextSequence(counterKey);
  const badachNumber = buildBadachNumber(system?.name ?? '', unit?.name ?? '', serial);

  // Build the form from the template's ordered BLOCKS. 'check' blocks snapshot
  // the classic task content (→ completed_tasks, unchanged pipeline); the other
  // block types snapshot their config (→ completed_blocks). A single global
  // sort_order sequence interleaves both so the בד״ח renders in the exact order
  // the admin designed. Everything is frozen here — later template edits never
  // change this historical document.
  // Source of truth for a NEW form: the PUBLISHED snapshot when the template has
  // one, else the live draft (legacy templates never published via the new flow
  // keep working as before). Published check blocks carry their content inline.
  type Norm = { refId: string; type: string; check?: PublishedCheckConfig; config?: unknown };
  let normalized: Norm[];
  if (template.published) {
    normalized = template.published.blocks.map((pb, i) =>
      pb.type === 'check'
        ? { refId: `pub-${i}`, type: 'check', check: pb.config as PublishedCheckConfig }
        : { refId: `pub-${i}`, type: pb.type, config: JSON.parse(JSON.stringify(pb.config)) }
    );
  } else {
    const effBlocks = await getEffectiveBlocks(params.templateId);
    const taskRows = await getTemplateTasks(params.templateId);
    const taskMap = new Map(taskRows.map((t) => [t.id, t]));
    normalized = effBlocks.map((b) => {
      if (b.type === 'check') {
        const t = taskMap.get((b.config as CheckRefConfig).task_id);
        return {
          refId: b.id,
          type: 'check',
          check: t
            ? {
                part_name: t.part_name,
                action: t.action,
                equipment: t.equipment,
                equipment_items: equipmentItemsOf(t.equipment_items, t.equipment),
                image_data: t.image_data,
              }
            : undefined,
        };
      }
      return { refId: b.id, type: b.type, config: JSON.parse(JSON.stringify(b.config)) };
    });
  }

  // Resolve the system+rank default minimum measurement duration ONCE and bake
  // it into each table snapshot that uses the default — so a later change to the
  // default never alters this historical בד״ח.
  const { getMeasureDurationDefault } = await import('./settings');
  const durationDefault = await getMeasureDurationDefault(template.system_id ?? null, template.rank_id ?? null);

  const taskSnaps: TaskSnapshot[] = [];
  const blockSnaps: BlockSnapshot[] = [];
  const draftTasks: CompletedTask[] = [];
  const draftBlocks: CompletedBlock[] = [];
  const formId = newId();

  normalized.forEach((n, i) => {
    if (n.type === 'check') {
      const c = n.check;
      if (!c) return;
      const items = equipmentItemsOf(c.equipment_items, c.equipment);
      taskSnaps.push({
        part_name: c.part_name,
        action: c.action,
        equipment: c.equipment,
        equipment_items: items,
        image_data: c.image_data,
        sort_order: i,
      });
      blockSnaps.push({ template_block_id: n.refId, type: 'check', sort_order: i, config: { task_id: n.refId } });
      draftTasks.push({
        id: newId(),
        completed_form_id: formId,
        part_name_snapshot: c.part_name,
        action_snapshot: c.action,
        equipment_snapshot: c.equipment,
        equipment_items_snapshot: items,
        image_snapshot: c.image_data,
        result: TaskResult.UNSET,
        comment: '',
        fault_image: null,
        sort_order: i,
      });
    } else {
      const cfg = JSON.parse(JSON.stringify(n.config)) as Record<string, unknown> & {
        duration?: { use_default?: boolean; min_minutes?: number };
      };
      // Freeze the effective minimum duration into the table snapshot.
      if (n.type === 'table' && cfg.duration) {
        if (cfg.duration.use_default) cfg.duration.min_minutes = durationDefault ?? undefined;
        cfg.duration.use_default = false;
      }
      blockSnaps.push({ template_block_id: n.refId, type: n.type as BlockSnapshot['type'], sort_order: i, config: cfg as BlockSnapshot['config'] });
      draftBlocks.push({
        id: newId(),
        completed_form_id: formId,
        template_block_id: n.refId,
        type: n.type as CompletedBlock['type'],
        sort_order: i,
        config_snapshot: cfg as CompletedBlock['config_snapshot'],
        data: n.type === 'table' ? { cells: {}, results: [] } : undefined,
      });
    }
  });

  const snapshot: TemplateSnapshot = {
    template_id: template.id,
    template_name: template.name,
    description: template.description,
    snapshot_at: nowIso(),
    tasks: taskSnaps,
    blocks: blockSnaps,
  };

  const form: CompletedForm = {
    id: formId,
    device_id: getDeviceId(),
    template_id: template.id,
    template_snapshot: snapshot,
    system_id: template.system_id ?? null,
    system_name_snapshot: system?.name ?? '',
    unit_id: params.unitId ?? null,
    unit_name_snapshot: unit?.name ?? '',
    rank_id: template.rank_id ?? null,
    rank_name_snapshot: rank?.name ?? '',
    template_name_snapshot: template.name,
    template_version_snapshot: template.version ?? 1,
    name: params.name?.trim() || template.name,
    number: badachNumber,
    // Classification is inherited from the rank (admin-set) and frozen here — a
    // later change to the rank never alters this historical document.
    classification: rank?.classification ?? DEFAULT_CLASSIFICATION,
    performer_user_id: params.performer.id,
    performer_name: params.performer.full_name,
    performer2_id: null,
    performer2_name: '',
    approver_user_id: null,
    approver_name: null,
    date: params.date || nowIso().slice(0, 10),
    status: FormStatus.DRAFT,
    created_at: nowIso(),
    updated_at: nowIso(),
    completed_at: null,
    approved_at: null,
  };
  await db.completed_forms.add(form);
  if (draftTasks.length) await db.completed_tasks.bulkAdd(draftTasks);
  if (draftBlocks.length) await db.completed_blocks.bulkAdd(draftBlocks);
  return formId;
}

/** Non-check execution blocks for a form, in order. */
export async function getFormBlocks(formId: string): Promise<CompletedBlock[]> {
  const blocks = await db.completed_blocks.where('completed_form_id').equals(formId).toArray();
  return blocks.sort((a, b) => a.sort_order - b.sort_order);
}

export async function getForm(formId: string): Promise<CompletedForm | undefined> {
  return db.completed_forms.get(formId);
}

export async function getFormTasks(formId: string): Promise<CompletedTask[]> {
  const tasks = await db.completed_tasks.where('completed_form_id').equals(formId).toArray();
  return tasks.sort((a, b) => a.sort_order - b.sort_order);
}

export async function getFormSignatures(formId: string): Promise<Signature[]> {
  return db.signatures.where('completed_form_id').equals(formId).toArray();
}

export async function getFormBundle(formId: string): Promise<FormBundle | null> {
  const form = await getForm(formId);
  if (!form) return null;
  const [tasks, blocks, signatures] = await Promise.all([
    getFormTasks(formId),
    getFormBlocks(formId),
    getFormSignatures(formId),
  ]);
  return { form, tasks, blocks, signatures };
}

/**
 * Record activity on a form: always refreshes updated_at (drives the drafts
 * time-stamp) and promotes a fresh DRAFT to IN_PROGRESS on first edit.
 */
async function touchInProgress(form: CompletedForm): Promise<void> {
  const patch: Partial<CompletedForm> = { updated_at: nowIso() };
  if (form.status === FormStatus.DRAFT) patch.status = FormStatus.IN_PROGRESS;
  await db.completed_forms.update(form.id, patch);
}

/** Guard: ensure the performer may still edit this form. */
async function assertEditable(formId: string, userId: string): Promise<CompletedForm> {
  const form = await getForm(formId);
  if (!form) throw new Error('הבד״ח לא נמצא');
  if (form.performer_user_id !== userId) throw new Error('רק מבצע הבד״ח יכול לערוך אותו');
  if (!isEditableByPerformer(form)) throw new Error('לא ניתן לערוך בד״ח שהועבר לאישור או אושר');
  return form;
}

export async function updateFormMeta(
  formId: string,
  userId: string,
  patch: Partial<Pick<CompletedForm, 'performer2_id' | 'performer2_name'>>
): Promise<void> {
  const form = await assertEditable(formId, userId);
  // Performer-2 gate (enforced here, not only by the filtered picker): an active
  // PERFORMER, not performer 1, and certified for this form's system + rank.
  if (patch.performer2_id) {
    if (patch.performer2_id === form.performer_user_id)
      throw new Error('מבצע 2 אינו יכול להיות זהה למבצע 1.');
    const u = await getUserById(patch.performer2_id);
    const roles = await getUserRoles(patch.performer2_id);
    if (!u || !u.active || !roles.includes(RoleName.PERFORMER))
      throw new Error('מבצע 2 חייב להיות משתמש פעיל בעל הרשאת מבצע.');
    const certified = await isUserCertified(patch.performer2_id, form.system_id, form.rank_id);
    if (!certified) throw new Error('מבצע 2 אינו מוסמך למערכת ולדרג של בד״ח זה.');
  }
  await db.completed_forms.update(formId, patch);
  await touchInProgress(form);
}

export async function setTaskResult(
  formId: string,
  userId: string,
  taskId: string,
  result: TaskResult
): Promise<void> {
  const form = await assertEditable(formId, userId);
  const task = await db.completed_tasks.get(taskId);
  if (!task) throw new Error('הסעיף לא נמצא');
  // The ORIGINAL results are frozen once a בד״ח has been returned for fix —
  // the performer documents the treatment instead of re-marking (history intact).
  if (form.status === FormStatus.REJECTED)
    throw new Error('לא ניתן לשנות תוצאת סעיף לאחר החזרה לתיקון. יש לדווח על ביצוע התיקון.');

  const patch: Partial<CompletedTask> = { result };
  if (result === TaskResult.FAULT) {
    // Record the discovery once — who found it and the exact time — and never
    // overwrite it, even if detail is edited later.
    if (!task.fault_reported_at) {
      const now = nowIso();
      patch.fault_reported_by_id = form.performer_user_id;
      patch.fault_reported_by_name = form.performer_name;
      patch.fault_reported_at = now;
      patch.fault_events = [
        ...(task.fault_events ?? []),
        { type: 'discovered', at: now, by_id: form.performer_user_id, by_name: form.performer_name },
      ];
    }
  } else {
    // Marking OK (still during the initial inspection) clears the fault detail
    // and its not-yet-submitted discovery so both can never be set at once.
    patch.comment = '';
    patch.fault_image = null;
    patch.fault_reported_by_id = '';
    patch.fault_reported_by_name = '';
    patch.fault_reported_at = '';
    patch.fault_events = [];
  }
  await db.completed_tasks.update(taskId, patch);
  await touchInProgress(form);
}

/**
 * Document the treatment of a section that the approver returned for fix.
 * Adds a repair_reported event (never overwrites the original result or the
 * fault history). If the fault was fixed, a description of what was done is
 * mandatory; an "after" photo is optional. The reporter, date and exact time
 * are captured automatically and cannot be edited by hand.
 */
export async function reportRepair(params: {
  formId: string;
  userId: string;
  taskId: string;
  done: boolean;
  description: string;
  image: string | null;
}): Promise<void> {
  const form = await assertEditable(params.formId, params.userId);
  const task = await db.completed_tasks.get(params.taskId);
  if (!task) throw new Error('הסעיף לא נמצא');
  if (!task.returned_for_fix) throw new Error('סעיף זה לא הוחזר לתיקון.');
  const desc = params.description.trim();
  if (params.done && !desc) throw new Error('יש לפרט מה בוצע בתיקון.');

  const now = nowIso();
  const ev: FaultEvent = {
    type: 'repair_reported',
    at: now,
    by_id: form.performer_user_id,
    by_name: form.performer_name,
    note: desc || undefined,
  };
  await db.completed_tasks.update(params.taskId, {
    repair_reported: true,
    repair_done: params.done,
    repair_description: desc,
    repair_image: params.image ?? null,
    repaired_by_id: form.performer_user_id,
    repaired_by_name: form.performer_name,
    repaired_at: now,
    fault_events: [...(task.fault_events ?? []), ev],
  });
  await db.completed_forms.update(form.id, { updated_at: now });
}

/**
 * Save the user-entered values of a table block and recompute its ±X results.
 * Autosaved to the local DB on every change (survives app restart). Numbers are
 * evaluated numerically; nothing here can force a result that contradicts the
 * data (the result is always derived from the cells).
 */
export async function setBlockData(
  formId: string,
  userId: string,
  blockId: string,
  cells: Record<string, string>
): Promise<void> {
  const form = await assertEditable(formId, userId);
  const block = await db.completed_blocks.get(blockId);
  if (!block || block.completed_form_id !== formId) throw new Error('הרכיב לא נמצא');
  if (block.type !== 'table') {
    await db.completed_blocks.update(blockId, { data: { cells } });
    await touchInProgress(form);
    return;
  }
  const { evaluateTableFull } = await import('./measurements');
  const config = block.config_snapshot as import('@/types').TableConfig;
  // Preserve the timer stamps (Start/Stop) across ordinary cell edits.
  const prev = block.data as import('@/types').TableData | undefined;
  const started_at = prev?.started_at ?? null;
  const ended_at = prev?.ended_at ?? null;
  const full = evaluateTableFull(config, cells, { started_at, ended_at });
  await db.completed_blocks.update(blockId, {
    data: {
      cells,
      started_at,
      ended_at,
      results: full.results,
      duration_result: full.duration_result,
      status: full.status,
      fail_reasons: full.fail_reasons,
    },
  });
  await touchInProgress(form);
}

/**
 * Measurement-duration timer (timer-mode tables): the performer presses
 * "התחל דגימה" to stamp the device clock as the start, and "סיום דגימה" to stamp
 * the end. 'reset' clears both for a fresh sample. The duration and PASS/FAIL are
 * always recomputed from these stamps — never set by hand — and the configured
 * minimum is still enforced (actual ≥ min to pass).
 */
export async function setBlockTimer(
  formId: string,
  userId: string,
  blockId: string,
  action: 'start' | 'stop' | 'reset'
): Promise<void> {
  const form = await assertEditable(formId, userId);
  const block = await db.completed_blocks.get(blockId);
  if (!block || block.completed_form_id !== formId) throw new Error('הרכיב לא נמצא');
  if (block.type !== 'table') throw new Error('רכיב זה אינו טבלת מדידה');
  const { evaluateTableFull } = await import('./measurements');
  const config = block.config_snapshot as import('@/types').TableConfig;
  const prev = block.data as import('@/types').TableData | undefined;
  const cells = prev?.cells ?? {};
  let started_at = prev?.started_at ?? null;
  let ended_at = prev?.ended_at ?? null;
  const now = nowIso();
  if (action === 'start') {
    started_at = now;
    ended_at = null; // a new sample clears any previous end
  } else if (action === 'stop') {
    if (!started_at) throw new Error('יש להתחיל דגימה לפני סיום');
    ended_at = now;
  } else {
    started_at = null;
    ended_at = null;
  }
  const full = evaluateTableFull(config, cells, { started_at, ended_at });
  await db.completed_blocks.update(blockId, {
    data: {
      cells,
      started_at,
      ended_at,
      results: full.results,
      duration_result: full.duration_result,
      status: full.status,
      fail_reasons: full.fail_reasons,
    },
  });
  await touchInProgress(form);
}

export async function setTaskComment(
  formId: string,
  userId: string,
  taskId: string,
  comment: string
): Promise<void> {
  const form = await assertEditable(formId, userId);
  await db.completed_tasks.update(taskId, { comment });
  await touchInProgress(form);
}

export async function setTaskFaultImage(
  formId: string,
  userId: string,
  taskId: string,
  faultImage: string | null
): Promise<void> {
  const form = await assertEditable(formId, userId);
  await db.completed_tasks.update(taskId, { fault_image: faultImage });
  await touchInProgress(form);
}

/**
 * Add (or replace) a signature of a given type for a form. The signer identity
 * (id + name) is taken from the system, not typed by hand. Each signature is
 * stored separately with its signer identity and timestamp.
 */
export async function addSignature(params: {
  formId: string;
  signer: { id: string; full_name: string };
  type: SignerType;
  signatureData: string;
}): Promise<void> {
  const existing = await db.signatures
    .where('completed_form_id')
    .equals(params.formId)
    .filter((s) => s.signer_type === params.type)
    .toArray();
  await db.signatures.bulkDelete(existing.map((s) => s.id));

  const sig: Signature = {
    id: newId(),
    completed_form_id: params.formId,
    signer_user_id: params.signer.id,
    signer_type: params.type,
    signer_name: params.signer.full_name,
    signer_role: '',
    signature_data: params.signatureData,
    signed_at: nowIso(),
  };
  await db.signatures.add(sig);
  await db.completed_forms.update(params.formId, { updated_at: nowIso() });
}

export interface SubmitValidation {
  ok: boolean;
  errors: string[];
}

/** Validate that a form is complete and ready to submit for approval. */
export async function validateForSubmit(formId: string): Promise<SubmitValidation> {
  const bundle = await getFormBundle(formId);
  const errors: string[] = [];
  if (!bundle) return { ok: false, errors: ['הבד״ח לא נמצא'] };
  const { form, tasks, blocks, signatures } = bundle;
  if (!form.name.trim()) errors.push('חסר שם בד״ח');
  if (!form.date) errors.push('חסר תאריך');
  if (!form.performer2_name?.trim())
    errors.push('יש לבחור מבצע שני. הבדיקה מחייבת שני מבצעים.');
  const unset = tasks.filter((t) => t.result === TaskResult.UNSET);
  if (unset.length) errors.push(`ישנם ${unset.length} סעיפים שלא סומנו (תקין/לא תקין)`);
  // Required measurement tables / columns must be filled before submit.
  for (const b of blocks) {
    if (b.type !== 'table') continue;
    const cfg = b.config_snapshot as import('@/types').TableConfig;
    const cells = b.data?.cells ?? {};
    const reqCols = cfg.columns.filter((c) => cfg.required || c.required);
    if (reqCols.length === 0) continue;
    const missing = cfg.rows.some((r) =>
      reqCols.some((c) => !(cells[`${r.id}|${c.id}`] ?? '').trim())
    );
    if (missing) errors.push(`יש למלא את כל השדות הנדרשים בטבלה "${cfg.title}"`);
  }
  const faultsMissingDetail = tasks.filter(
    (t) => t.result === TaskResult.FAULT && !t.comment.trim()
  );
  if (faultsMissingDetail.length)
    errors.push(`ישנם ${faultsMissingDetail.length} סעיפים לא תקינים ללא פירוט תקלה`);
  const perf1Sig = signatures.find((s) => s.signer_type === SignerType.PERFORMER);
  if (!perf1Sig) errors.push('חסרה חתימת מבצע 1');
  const perf2Sig = signatures.find((s) => s.signer_type === SignerType.PERFORMER2);
  if (!perf2Sig) errors.push('חסרה חתימת מבצע 2');
  // A returned בד״ח can be re-submitted only once every returned section has a
  // documented treatment.
  if (form.status === FormStatus.REJECTED) {
    const untreated = tasks.filter((t) => t.returned_for_fix && !t.repair_reported);
    if (untreated.length)
      errors.push(`ישנם ${untreated.length} סעיפים שהוחזרו לתיקון וטרם דווח עליהם טיפול`);
  }
  return { ok: errors.length === 0, errors };
}

/** Submit a form for approval (status → PENDING_APPROVAL). */
export async function submitForApproval(formId: string, userId: string): Promise<void> {
  const form = await getForm(formId);
  if (!form) throw new Error('הבד״ח לא נמצא');
  if (form.performer_user_id !== userId) throw new Error('רק מבצע הבד״ח יכול להעביר לאישור');
  if (!isEditableByPerformer(form)) throw new Error('הבד״ח כבר הועבר לאישור');
  const v = await validateForSubmit(formId);
  if (!v.ok) throw new Error(v.errors.join(' · '));
  const now = nowIso();
  // Re-submission after a return: stamp a "resubmitted" event on every section
  // that was returned and treated, so its timeline stays continuous.
  if (form.status === FormStatus.REJECTED) {
    const tasks = await getFormTasks(formId);
    await Promise.all(
      tasks
        .filter((t) => t.returned_for_fix && t.repair_reported)
        .map((t) =>
          db.completed_tasks.update(t.id, {
            fault_events: [
              ...(t.fault_events ?? []),
              { type: 'resubmitted', at: now, by_id: form.performer_user_id, by_name: form.performer_name },
            ],
          })
        )
    );
  }
  await db.completed_forms.update(formId, {
    status: FormStatus.PENDING_APPROVAL,
    completed_at: now,
    updated_at: now,
  });

  // Audit meaningful measurement outcomes (a ±X exceedance), so a gap breach is
  // traceable — without flooding the log with a per-keystroke event.
  const blocks = await getFormBlocks(formId);
  const tableBlocks = blocks.filter((b) => b.type === 'table');
  if (tableBlocks.length) {
    const { logAudit } = await import('./audit');
    for (const b of tableBlocks) {
      const cfg = b.config_snapshot as import('@/types').TableConfig;
      if (b.data?.status === 'fail') {
        await logAudit({
          user_id: form.performer_user_id,
          user_name: form.performer_name,
          action: 'MEASUREMENT_FAILED',
          entity_type: 'completed_form',
          entity_id: formId,
          field: cfg.title,
          new_value: (b.data.fail_reasons ?? []).join(' | ') || 'הבדיקה נכשלה',
        });
      }
    }
  }
}

// -------------------------------------------------------------------------
// Queries / lists / stats
// -------------------------------------------------------------------------

export async function listFormsByPerformer(userId: string): Promise<CompletedForm[]> {
  const forms = await db.completed_forms.where('performer_user_id').equals(userId).toArray();
  return sortByCreatedDesc(forms);
}

export async function listPendingApproval(): Promise<CompletedForm[]> {
  const forms = await db.completed_forms
    .where('status')
    .equals(FormStatus.PENDING_APPROVAL)
    .toArray();
  return sortByCreatedDesc(forms);
}

export async function listAllForms(): Promise<CompletedForm[]> {
  const forms = await db.completed_forms.toArray();
  return sortByCreatedDesc(forms);
}

/** Forms currently routed to a treating rank (for the treatment inbox). */
export async function listInTreatment(): Promise<CompletedForm[]> {
  const forms = await db.completed_forms
    .where('status')
    .equals(FormStatus.IN_TREATMENT)
    .toArray();
  return sortByCreatedDesc(forms);
}

/** Draft / in-progress forms belonging to a user (for "continue unfinished"). */
export async function listDrafts(userId: string): Promise<CompletedForm[]> {
  const forms = await listFormsByPerformer(userId);
  return forms.filter((f) => isEditableByPerformer(f));
}

function sortByCreatedDesc(forms: CompletedForm[]): CompletedForm[] {
  return forms.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export interface FormRowStats {
  taskCount: number;
  faultCount: number;
}

export async function getFormStats(formId: string): Promise<FormRowStats> {
  const tasks = await getFormTasks(formId);
  return {
    taskCount: tasks.length,
    faultCount: tasks.filter((t) => t.result === TaskResult.FAULT).length,
  };
}

export interface UserFormSummary {
  total: number;
  approved: number;
  pending: number;
  withFaults: number;
}

export async function getUserSummary(userId: string): Promise<UserFormSummary> {
  const forms = await listFormsByPerformer(userId);
  let withFaults = 0;
  for (const f of forms) {
    const stats = await getFormStats(f.id);
    if (stats.faultCount > 0) withFaults++;
  }
  return {
    total: forms.length,
    approved: forms.filter((f) => f.status === FormStatus.APPROVED).length,
    pending: forms.filter((f) => f.status === FormStatus.PENDING_APPROVAL).length,
    withFaults,
  };
}

export interface DashboardStats {
  today: number;
  month: number;
  approved: number;
  pending: number;
  withFaults: number;
  recentPending: CompletedForm[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const forms = await listAllForms();
  const today = nowIso().slice(0, 10);
  const month = nowIso().slice(0, 7);
  let withFaults = 0;
  for (const f of forms) {
    const stats = await getFormStats(f.id);
    if (stats.faultCount > 0) withFaults++;
  }
  return {
    today: forms.filter((f) => f.created_at.slice(0, 10) === today).length,
    month: forms.filter((f) => f.created_at.slice(0, 7) === month).length,
    approved: forms.filter((f) => f.status === FormStatus.APPROVED).length,
    pending: forms.filter((f) => f.status === FormStatus.PENDING_APPROVAL).length,
    withFaults,
    recentPending: forms.filter((f) => f.status === FormStatus.PENDING_APPROVAL).slice(0, 8),
  };
}

export interface BreakdownRow {
  key: string;
  label: string;
  total: number;
  approved: number;
  faults: number;
}

export interface DashboardBreakdowns {
  bySystem: BreakdownRow[];
  byUnit: BreakdownRow[];
  byRank: BreakdownRow[];
  byTemplate: BreakdownRow[];
  byPerformer: BreakdownRow[];
  byMonth: BreakdownRow[];
  okItems: number;
  faultItems: number;
  totalForms: number;
}

/**
 * Aggregate all completed forms into the hierarchy breakdowns the admin
 * dashboard charts. Snapshots are used so history stays stable even after a
 * system/unit/rank/template is renamed or disabled.
 */
export async function getDashboardBreakdowns(): Promise<DashboardBreakdowns> {
  const forms = await listAllForms();

  const buckets: Record<
    'bySystem' | 'byUnit' | 'byRank' | 'byTemplate' | 'byPerformer' | 'byMonth',
    Map<string, BreakdownRow>
  > = {
    bySystem: new Map(),
    byUnit: new Map(),
    byRank: new Map(),
    byTemplate: new Map(),
    byPerformer: new Map(),
    byMonth: new Map(),
  };

  const bump = (
    map: Map<string, BreakdownRow>,
    key: string,
    label: string,
    approved: boolean,
    hasFault: boolean
  ) => {
    const row = map.get(key) ?? { key, label, total: 0, approved: 0, faults: 0 };
    row.total += 1;
    if (approved) row.approved += 1;
    if (hasFault) row.faults += 1;
    map.set(key, row);
  };

  let okItems = 0;
  let faultItems = 0;

  for (const f of forms) {
    const tasks = await getFormTasks(f.id);
    const faults = tasks.filter((t) => t.result === TaskResult.FAULT).length;
    okItems += tasks.filter((t) => t.result === TaskResult.OK).length;
    faultItems += faults;
    const approved = f.status === FormStatus.APPROVED;
    const hasFault = faults > 0;

    bump(buckets.bySystem, f.system_id ?? '—', f.system_name_snapshot || 'ללא סוג מערכת', approved, hasFault);
    bump(buckets.byUnit, f.unit_id ?? '—', f.unit_name_snapshot || 'ללא יחידה', approved, hasFault);
    bump(buckets.byRank, f.rank_id ?? '—', f.rank_name_snapshot || 'ללא דרג', approved, hasFault);
    bump(
      buckets.byTemplate,
      f.template_id,
      f.template_name_snapshot || f.name,
      approved,
      hasFault
    );
    bump(buckets.byPerformer, f.performer_user_id, f.performer_name, approved, hasFault);
    bump(buckets.byMonth, f.date.slice(0, 7), f.date.slice(0, 7), approved, hasFault);
  }

  const sortDesc = (m: Map<string, BreakdownRow>) =>
    [...m.values()].sort((a, b) => b.total - a.total);
  const sortMonth = (m: Map<string, BreakdownRow>) =>
    [...m.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-6);

  return {
    bySystem: sortDesc(buckets.bySystem),
    byUnit: sortDesc(buckets.byUnit),
    byRank: sortDesc(buckets.byRank),
    byTemplate: sortDesc(buckets.byTemplate),
    byPerformer: sortDesc(buckets.byPerformer),
    byMonth: sortMonth(buckets.byMonth),
    okItems,
    faultItems,
    totalForms: forms.length,
  };
}

export async function deleteDraft(formId: string, userId: string): Promise<void> {
  const form = await getForm(formId);
  if (!form) return;
  if (form.performer_user_id !== userId) throw new Error('אין הרשאה למחוק בד״ח זה');
  if (!isEditableByPerformer(form)) throw new Error('לא ניתן למחוק בד״ח שהועבר לאישור/אושר');
  const tasks = await getFormTasks(formId);
  await db.completed_tasks.bulkDelete(tasks.map((t) => t.id));
  const blocks = await getFormBlocks(formId);
  await db.completed_blocks.bulkDelete(blocks.map((b) => b.id));
  const sigs = await getFormSignatures(formId);
  await db.signatures.bulkDelete(sigs.map((s) => s.id));
  await db.completed_forms.delete(formId);
}
