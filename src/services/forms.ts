import { db } from '@/data/db';
import { newId, nowIso, getDeviceId } from './ids';
import { getTemplate, getTemplateTasks } from './templates';
import { getSystem } from './systems';
import {
  FormStatus,
  SignerType,
  TaskResult,
  type CompletedForm,
  type CompletedTask,
  type Signature,
  type TemplateSnapshot,
  type UserWithRoles,
} from '@/types';

/** Full aggregate for a form. */
export interface FormBundle {
  form: CompletedForm;
  tasks: CompletedTask[];
  signatures: Signature[];
}

/** A form is editable by the performer only while it is a draft / in progress. */
export function isEditableByPerformer(form: CompletedForm): boolean {
  return form.status === FormStatus.DRAFT || form.status === FormStatus.IN_PROGRESS;
}

export function isLocked(form: CompletedForm): boolean {
  return form.status === FormStatus.APPROVED;
}

/** Create a new draft form: freezes a snapshot of the template content. */
export async function createDraftForm(params: {
  templateId: string;
  performer: UserWithRoles;
  name?: string;
  number?: string;
  date?: string;
}): Promise<string> {
  const template = await getTemplate(params.templateId);
  if (!template) throw new Error('התבנית לא נמצאה');
  const templateTasks = await getTemplateTasks(params.templateId);
  const system = template.system_id ? await getSystem(template.system_id) : undefined;

  const snapshot: TemplateSnapshot = {
    template_id: template.id,
    template_name: template.name,
    description: template.description,
    snapshot_at: nowIso(),
    tasks: templateTasks.map((t) => ({
      part_name: t.part_name,
      action: t.action,
      equipment: t.equipment,
      image_data: t.image_data,
      sort_order: t.sort_order,
    })),
  };

  const formId = newId();
  const form: CompletedForm = {
    id: formId,
    device_id: getDeviceId(),
    template_id: template.id,
    template_snapshot: snapshot,
    system_id: template.system_id ?? null,
    system_name_snapshot: system?.name ?? '',
    name: params.name?.trim() || template.name,
    number: params.number?.trim() || '',
    performer_user_id: params.performer.id,
    performer_name: params.performer.full_name,
    approver_user_id: null,
    approver_name: null,
    date: params.date || nowIso().slice(0, 10),
    status: FormStatus.DRAFT,
    created_at: nowIso(),
    completed_at: null,
    approved_at: null,
  };
  await db.completed_forms.add(form);

  const tasks: CompletedTask[] = snapshot.tasks.map((t) => ({
    id: newId(),
    completed_form_id: formId,
    part_name_snapshot: t.part_name,
    action_snapshot: t.action,
    equipment_snapshot: t.equipment,
    image_snapshot: t.image_data,
    result: TaskResult.UNSET,
    comment: '',
    fault_image: null,
    sort_order: t.sort_order,
  }));
  if (tasks.length) await db.completed_tasks.bulkAdd(tasks);
  return formId;
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
  const [tasks, signatures] = await Promise.all([
    getFormTasks(formId),
    getFormSignatures(formId),
  ]);
  return { form, tasks, signatures };
}

async function touchInProgress(form: CompletedForm): Promise<void> {
  if (form.status === FormStatus.DRAFT) {
    await db.completed_forms.update(form.id, { status: FormStatus.IN_PROGRESS });
  }
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
  patch: Partial<Pick<CompletedForm, 'name' | 'number' | 'date'>>
): Promise<void> {
  const form = await assertEditable(formId, userId);
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
  const patch: Partial<CompletedTask> = { result };
  // Marking OK clears any fault detail so both can never be set at once.
  if (result !== TaskResult.FAULT) {
    patch.comment = '';
    patch.fault_image = null;
  }
  await db.completed_tasks.update(taskId, patch);
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

/** Add (or replace) a signature of a given type for a form. */
export async function addSignature(params: {
  formId: string;
  signer: UserWithRoles;
  type: SignerType;
  signerRole: string;
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
    signer_role: params.signerRole.trim(),
    signature_data: params.signatureData,
    signed_at: nowIso(),
  };
  await db.signatures.add(sig);
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
  const { form, tasks, signatures } = bundle;
  if (!form.name.trim()) errors.push('חסר שם בד״ח');
  if (!form.date) errors.push('חסר תאריך');
  const unset = tasks.filter((t) => t.result === TaskResult.UNSET);
  if (unset.length) errors.push(`ישנם ${unset.length} סעיפים שלא סומנו (תקין/לא תקין)`);
  const faultsMissingDetail = tasks.filter(
    (t) => t.result === TaskResult.FAULT && !t.comment.trim()
  );
  if (faultsMissingDetail.length)
    errors.push(`ישנם ${faultsMissingDetail.length} סעיפים לא תקינים ללא פירוט תקלה`);
  const perfSig = signatures.find((s) => s.signer_type === SignerType.PERFORMER);
  if (!perfSig) errors.push('חסרה חתימת מבצע');
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
  await db.completed_forms.update(formId, {
    status: FormStatus.PENDING_APPROVAL,
    completed_at: nowIso(),
  });
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

export async function deleteDraft(formId: string, userId: string): Promise<void> {
  const form = await getForm(formId);
  if (!form) return;
  if (form.performer_user_id !== userId) throw new Error('אין הרשאה למחוק בד״ח זה');
  if (!isEditableByPerformer(form)) throw new Error('לא ניתן למחוק בד״ח שהועבר לאישור/אושר');
  const tasks = await getFormTasks(formId);
  await db.completed_tasks.bulkDelete(tasks.map((t) => t.id));
  const sigs = await getFormSignatures(formId);
  await db.signatures.bulkDelete(sigs.map((s) => s.id));
  await db.completed_forms.delete(formId);
}
