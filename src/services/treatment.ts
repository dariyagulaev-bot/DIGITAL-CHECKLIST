import { db } from '@/data/db';
import { nowIso } from './ids';
import { logAudit } from './audit';
import { canApprove, assert } from './rbac';
import { getForm, getFormTasks, getFormSignatures } from './forms';
import { getRank } from './ranks';
import { getUserById, getUserRoles } from './auth';
import {
  countCertifiedPerformers,
  isUserCertified,
  getMaxRankId,
  listCertifiedPerformerUsers,
} from './certifications';
import { SELF_APPROVAL_MESSAGE } from './approval';
import {
  FormStatus,
  RoleName,
  SignerType,
  TaskResult,
  type CompletedForm,
  type CompletedTask,
  type FaultEvent,
  type UserWithRoles,
} from '@/types';

/**
 * Transfer-to-treatment-rank subsystem (העברה לדרג מטפל).
 *
 * A generic mechanism: the approver may route one or more faulty sections of a
 * submitted בד״ח to a HIGHER treating rank for repair. The UI exposes only
 * "העבר לדרג ד׳", but the backend takes any treating rank, so new treating ranks
 * need no code change.
 *
 * Everything is additive history — the ORIGINAL inspection rank, the original
 * performers and their signatures are never overwritten. The treatment is done
 * by dedicated repair performers (מבצע תיקון 1/2) who must be active PERFORMER
 * users certified for the system AT LEAST to the treating rank, documented with
 * their own NEW signatures, and finally verified by the approver — only then does
 * the section's CURRENT status flip to "תקין" (the stored original result stays
 * "לא תקין" for traceability).
 */

const MIN_TREATMENT_PERFORMERS = 2; // two repair performers required (1 + 2)

/** One section the approver is transferring, with its own reason. */
export interface TransferSection {
  taskId: string;
  note: string;
}

/** Minimum certified manpower the treating rank needs so a transfer is viable. */
export async function hasEnoughTreatmentManpower(
  systemId: string | null,
  treatmentRankId: string
): Promise<boolean> {
  const n = await countCertifiedPerformers(systemId, treatmentRankId);
  return n >= MIN_TREATMENT_PERFORMERS;
}

/**
 * Approver transfers faulty section(s) to a treating rank. Validates the rank,
 * the sections (only "לא תקין" originals), and that enough certified manpower
 * exists in the treating rank before the transfer is allowed to complete.
 * Original performer signatures are KEPT (they still vouch for the original
 * inspection); the treatment collects its own signatures later.
 */
export async function transferToTreatmentRank(params: {
  formId: string;
  approver: UserWithRoles;
  treatmentRankId: string;
  sections: TransferSection[];
  generalNote?: string;
}): Promise<void> {
  const { formId, approver, treatmentRankId } = params;
  const form = await getForm(formId);
  assert(!!form, 'הבד״ח לא נמצא');
  assert(
    form!.status === FormStatus.PENDING_APPROVAL,
    'ניתן להעביר לדרג מטפל רק בד״ח הממתין לאישור'
  );
  assert(canApprove(approver), 'למשתמש אין הרשאת מאשר.');
  assert(approver.id !== form!.performer_user_id, SELF_APPROVAL_MESSAGE);

  const treatingRank = await getRank(treatmentRankId);
  assert(!!treatingRank, 'דרג הטיפול לא נמצא.');

  const tasks = await getFormTasks(formId);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const failIds = new Set(tasks.filter((t) => t.result === TaskResult.FAULT).map((t) => t.id));
  assert(
    failIds.size > 0,
    'לא ניתן להעביר לטיפול בד״ח שכל סעיפיו תקינים — נדרש לפחות סעיף אחד "לא תקין".'
  );

  const picked = params.sections.filter((s) => s.taskId && s.note.trim());
  assert(picked.length > 0, 'יש לבחור לפחות סעיף אחד (לא תקין) להעברה לטיפול.');
  assert(
    picked.every((s) => failIds.has(s.taskId)),
    'ניתן להעביר לטיפול רק סעיפים שתוצאתם המקורית "לא תקין".'
  );

  // Manpower gate — BEFORE completing the transfer (part יג).
  const enough = await hasEnoughTreatmentManpower(form!.system_id, treatmentRankId);
  assert(
    enough,
    `לא קיימים מספיק מבצעים פעילים המוסמכים למערכת זו בדרג ${treatingRank!.name}. נדרשים לפחות ${MIN_TREATMENT_PERFORMERS} מבצעי תיקון.`
  );

  const now = nowIso();
  for (const sel of picked) {
    const t = byId.get(sel.taskId);
    if (!t) continue;
    const ev: FaultEvent = {
      type: 'transferred',
      at: now,
      by_id: approver.id,
      by_name: approver.full_name,
      note: sel.note.trim(),
    };
    await db.completed_tasks.update(sel.taskId, {
      transferred_for_treatment: true,
      transfer_section_note: sel.note.trim(),
      // A re-transfer after a previous cycle clears the old treatment report so a
      // fresh treatment is required; the event log keeps the full history.
      repair_reported: false,
      verified: false,
      fault_events: [...(t.fault_events ?? []), ev],
    });
  }

  await db.completed_forms.update(formId, {
    status: FormStatus.IN_TREATMENT,
    treatment_rank_id: treatmentRankId,
    treatment_rank_name: treatingRank!.name,
    transferred_by_id: approver.id,
    transferred_by_name: approver.full_name,
    transferred_at: now,
    transfer_note: (params.generalNote ?? '').trim() || undefined,
    // Reset any repair performers/signatures from a prior cycle so a fresh
    // treating team is assigned for this transfer.
    treatment_performer1_id: null,
    treatment_performer1_name: '',
    treatment_performer2_id: null,
    treatment_performer2_name: '',
    updated_at: now,
  });

  // Invalidate any repair-performer signatures from a previous treatment cycle
  // (original performer/approver signatures are kept untouched).
  const sigs = await getFormSignatures(formId);
  const stale = sigs.filter(
    (s) => s.signer_type === SignerType.REPAIR_PERFORMER || s.signer_type === SignerType.REPAIR_PERFORMER2
  );
  if (stale.length) await db.signatures.bulkDelete(stale.map((s) => s.id));

  await logAudit({
    user_id: approver.id,
    user_name: approver.full_name,
    action: 'TRANSFER_TO_TREATMENT',
    entity_type: 'completed_form',
    entity_id: formId,
    field: treatmentRankId,
    new_value: FormStatus.IN_TREATMENT,
    reason: [params.generalNote?.trim(), ...picked.map((p) => p.note.trim())]
      .filter(Boolean)
      .join(' | '),
  });
}

/** A user who may act on the treatment (certified to the treating rank, or admin). */
async function assertTreatmentActor(
  form: CompletedForm,
  userId: string
): Promise<{ id: string; full_name: string; isAdmin: boolean }> {
  const u = await getUserById(userId);
  assert(!!u && u.active, 'המשתמש אינו פעיל.');
  const roles = await getUserRoles(userId);
  const isAdmin = roles.includes(RoleName.ADMIN);
  if (!isAdmin) {
    assert(roles.includes(RoleName.PERFORMER), 'נדרש מבצע מוסמך לדרג המטפל.');
    const ok = await isUserCertified(userId, form.system_id, form.treatment_rank_id ?? null);
    assert(ok, 'אינך מוסמך לטפל בבד״ח זה בדרג הטיפול.');
  }
  return { id: u!.id, full_name: u!.full_name, isAdmin };
}

/**
 * Assign the two repair performers for this treatment. Both must be active
 * PERFORMER users certified for the system at least to the treating rank, and
 * they cannot be the same user. (They MAY be the original performers — the
 * treatment is a separate, higher-rank action; what matters is the rank-ד
 * certification.)
 */
export async function setTreatmentPerformers(params: {
  formId: string;
  actingUserId: string;
  performer1Id: string;
  performer1Name: string;
  performer2Id: string;
  performer2Name: string;
}): Promise<void> {
  const form = await getForm(params.formId);
  assert(!!form, 'הבד״ח לא נמצא');
  assert(form!.status === FormStatus.IN_TREATMENT, 'הבד״ח אינו בטיפול דרג מטפל.');
  await assertTreatmentActor(form!, params.actingUserId);

  assert(
    params.performer1Id !== params.performer2Id,
    'לא ניתן לבחור את אותו מבצע תיקון פעמיים.'
  );
  for (const pid of [params.performer1Id, params.performer2Id]) {
    const u = await getUserById(pid);
    const roles = await getUserRoles(pid);
    assert(
      !!u && u.active && roles.includes(RoleName.PERFORMER),
      'מבצע תיקון חייב להיות משתמש פעיל בעל הרשאת מבצע.'
    );
    const ok = await isUserCertified(pid, form!.system_id, form!.treatment_rank_id ?? null);
    assert(ok, 'מבצע תיקון חייב להיות מוסמך למערכת ולדרג הטיפול.');
  }

  await db.completed_forms.update(params.formId, {
    treatment_performer1_id: params.performer1Id,
    treatment_performer1_name: params.performer1Name,
    treatment_performer2_id: params.performer2Id,
    treatment_performer2_name: params.performer2Name,
    updated_at: nowIso(),
  });
}

/** List candidate repair performers for a form (certified to its treating rank). */
export function listTreatmentPerformerCandidates(
  form: Pick<CompletedForm, 'system_id' | 'treatment_rank_id'>,
  excludeUserId?: string
): Promise<Array<{ id: string; full_name: string }>> {
  return listCertifiedPerformerUsers(form.system_id, form.treatment_rank_id ?? null, excludeUserId);
}

/**
 * Document the treatment of a transferred section (what was done, after photo).
 * Only an assigned repair performer (or an admin) may report. The reporter, date
 * and exact time are captured automatically. The original result and fault
 * history are never overwritten.
 */
export async function reportTreatment(params: {
  formId: string;
  actingUserId: string;
  taskId: string;
  done: boolean;
  description: string;
  image: string | null;
}): Promise<void> {
  const form = await getForm(params.formId);
  assert(!!form, 'הבד״ח לא נמצא');
  assert(form!.status === FormStatus.IN_TREATMENT, 'הבד״ח אינו בטיפול דרג מטפל.');
  const actor = await assertTreatmentActor(form!, params.actingUserId);
  // Must be one of the assigned repair performers (admins may act too).
  if (!actor.isAdmin) {
    assert(
      params.actingUserId === form!.treatment_performer1_id ||
        params.actingUserId === form!.treatment_performer2_id,
      'רק מבצעי התיקון שהוקצו לבד״ח זה יכולים לדווח על הטיפול.'
    );
  }

  const task = await db.completed_tasks.get(params.taskId);
  assert(!!task, 'הסעיף לא נמצא');
  assert(!!task!.transferred_for_treatment, 'סעיף זה לא הועבר לטיפול דרג מטפל.');
  const desc = params.description.trim();
  assert(!params.done || !!desc, 'יש לפרט מה בוצע בתיקון.');

  const now = nowIso();
  const ev: FaultEvent = {
    type: 'repair_reported',
    at: now,
    by_id: actor.id,
    by_name: actor.full_name,
    note: desc || undefined,
  };
  await db.completed_tasks.update(params.taskId, {
    repair_reported: true,
    repair_done: params.done,
    repair_description: desc,
    repair_image: params.image ?? null,
    repaired_by_id: actor.id,
    repaired_by_name: actor.full_name,
    repaired_at: now,
    fault_events: [...(task!.fault_events ?? []), ev],
  });
  await db.completed_forms.update(params.formId, { updated_at: now });
}

export interface TreatmentValidation {
  ok: boolean;
  errors: string[];
}

/** Validate that the whole treatment is ready to go back to the approver. */
export async function validateTreatmentForApproval(formId: string): Promise<TreatmentValidation> {
  const form = await getForm(formId);
  const errors: string[] = [];
  if (!form) return { ok: false, errors: ['הבד״ח לא נמצא'] };
  if (!form.treatment_performer1_id || !form.treatment_performer2_id)
    errors.push('יש לבחור שני מבצעי תיקון.');

  const tasks = await getFormTasks(formId);
  const transferred = tasks.filter((t) => t.transferred_for_treatment);
  if (transferred.length === 0) errors.push('לא קיימים סעיפים שהועברו לטיפול.');
  const undocumented = transferred.filter((t) => !t.repair_reported);
  if (undocumented.length)
    errors.push(`ישנם ${undocumented.length} סעיפים שהועברו לטיפול ללא דיווח טיפול.`);

  const sigs = await getFormSignatures(formId);
  const s1 = sigs.find((s) => s.signer_type === SignerType.REPAIR_PERFORMER);
  const s2 = sigs.find((s) => s.signer_type === SignerType.REPAIR_PERFORMER2);
  if (!s1 || !s2) errors.push('נדרשות חתימות שני מבצעי התיקון.');

  return { ok: errors.length === 0, errors };
}

/**
 * Send a documented, signed treatment back to the approver for final
 * verification. Moves the form from IN_TREATMENT → PENDING_APPROVAL and stamps a
 * "resubmitted" event on each transferred section.
 */
export async function submitTreatmentForApproval(
  formId: string,
  actingUserId: string
): Promise<void> {
  const form = await getForm(formId);
  assert(!!form, 'הבד״ח לא נמצא');
  assert(form!.status === FormStatus.IN_TREATMENT, 'הבד״ח אינו בטיפול דרג מטפל.');
  const actor = await assertTreatmentActor(form!, actingUserId);
  if (!actor.isAdmin) {
    assert(
      actingUserId === form!.treatment_performer1_id ||
        actingUserId === form!.treatment_performer2_id,
      'רק מבצעי התיקון שהוקצו לבד״ח זה יכולים לשלוח את הטיפול לאישור.'
    );
  }

  const v = await validateTreatmentForApproval(formId);
  assert(v.ok, v.errors.join(' · '));

  const now = nowIso();
  const tasks = await getFormTasks(formId);
  await Promise.all(
    tasks
      .filter((t: CompletedTask) => t.transferred_for_treatment && t.repair_reported)
      .map((t) =>
        db.completed_tasks.update(t.id, {
          fault_events: [
            ...(t.fault_events ?? []),
            { type: 'resubmitted', at: now, by_id: actor.id, by_name: actor.full_name },
          ],
        })
      )
  );

  await db.completed_forms.update(formId, {
    status: FormStatus.PENDING_APPROVAL,
    completed_at: now,
    updated_at: now,
  });

  await logAudit({
    user_id: actor.id,
    user_name: actor.full_name,
    action: 'SUBMIT_TREATMENT',
    entity_type: 'completed_form',
    entity_id: formId,
    new_value: FormStatus.PENDING_APPROVAL,
  });
}

/** Does this form have any section currently routed to a treating rank? */
export function formHasTreatment(form: Pick<CompletedForm, 'treatment_rank_id'>): boolean {
  return !!form.treatment_rank_id;
}

/** The highest rank certified for the user (helper for UI hints). */
export { getMaxRankId };
