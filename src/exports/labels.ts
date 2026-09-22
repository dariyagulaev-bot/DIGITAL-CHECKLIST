import { FormStatus, RoleName, TaskResult, type CompletedForm } from '@/types';

/**
 * Official document number in the format the client specified:
 * "מס' בד״ח – [שם המערכת] – [מספר]". Parts that are missing are dropped so the
 * line never shows dangling separators.
 */
export function formDocumentTitle(
  form: Pick<CompletedForm, 'system_name_snapshot' | 'number' | 'name'>
): string {
  const parts = ["מס' בד״ח"];
  if (form.system_name_snapshot) parts.push(form.system_name_snapshot);
  parts.push(form.number?.trim() || form.name);
  return parts.join(' – ');
}

/** Split legacy equipment text into a list (on commas / new lines). */
export function splitEquipmentText(text: string | undefined | null): string[] {
  return (text ?? '')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Resolve the equipment of a task to an ordered list of items. Prefers the
 * structured `equipment_items` list; falls back to splitting the legacy
 * `equipment` string so old data still renders as a clean list.
 */
export function equipmentItemsOf(
  items: string[] | undefined,
  fallbackText: string | undefined | null
): string[] {
  const list = (items ?? []).map((s) => s.trim()).filter(Boolean);
  return list.length ? list : splitEquipmentText(fallbackText);
}

export function statusLabel(status: FormStatus): string {
  switch (status) {
    case FormStatus.DRAFT:
      return 'טיוטה';
    case FormStatus.IN_PROGRESS:
      return 'בביצוע';
    case FormStatus.PENDING_APPROVAL:
      return 'ממתין לאישור';
    case FormStatus.APPROVED:
      return 'מאושר';
    case FormStatus.REJECTED:
      return 'הוחזר לתיקון';
    default:
      return status;
  }
}

export function resultLabel(result: TaskResult): string {
  switch (result) {
    case TaskResult.OK:
      return 'תקין';
    case TaskResult.FAULT:
      return 'לא תקין';
    default:
      return '—';
  }
}

export function roleLabel(role: RoleName): string {
  switch (role) {
    case RoleName.PERFORMER:
      return 'מבצע';
    case RoleName.APPROVER:
      return 'מאשר';
    case RoleName.ADMIN:
      return 'מנהל';
    default:
      return role;
  }
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** DD.MM.YYYY with leading zeros (official report footer format). */
export function formatDateDots(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** HH:MM (24h). */
export function formatTimeHM(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Clean stamp for UI / documents: "16.09.2026 | 14:37" (seconds kept in DB). */
export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  return `${formatDateDots(iso)} | ${formatTimeHM(iso)}`;
}

/** Short day+time for the compact treatment timeline: "16.09 14:37". */
export function formatDayTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Human label for a fault-lifecycle event (used in the compact timeline). */
export function faultEventLabel(type: string, repairDone?: boolean): string {
  switch (type) {
    case 'discovered':
      return 'תקלה התגלתה';
    case 'returned':
      return 'הוחזר לתיקון';
    case 'repair_reported':
      return repairDone === false ? 'דווח כלא תוקן' : 'דווח כתוקן';
    case 'resubmitted':
      return 'נשלח מחדש';
    case 'verified':
      return 'אומת ואושר';
    default:
      return type;
  }
}

/** Status of a handled fault, for the report chip. */
export function faultTreatmentStatus(t: {
  returned_for_fix?: boolean;
  repair_reported?: boolean;
  repair_done?: boolean;
  verified?: boolean;
}): string {
  if (!t.returned_for_fix) return 'לא תקין';
  if (t.verified) return t.repair_done === false ? 'לא תוקן — אומת' : 'תוקן ואומת';
  if (t.repair_reported) return t.repair_done === false ? 'לא תוקן' : 'תוקן — ממתין לאימות';
  return 'הוחזר לתיקון';
}

/**
 * A fault is "resolved" once it was returned, actually repaired, and the
 * approver verified it. Only then does the section's CURRENT status flip.
 */
export function isResolvedFault(t: {
  result: TaskResult;
  returned_for_fix?: boolean;
  repair_done?: boolean;
  verified?: boolean;
}): boolean {
  return (
    t.result === TaskResult.FAULT &&
    !!t.returned_for_fix &&
    t.repair_done === true &&
    !!t.verified
  );
}

/**
 * The section's CURRENT status. A resolved fault now reads as "תקין"; the stored
 * `result` field is never changed, so the report's treatment section, the בד״ח
 * history and the Audit log all keep the original "לא תקין" finding for full
 * traceability.
 */
export function currentResult(t: {
  result: TaskResult;
  returned_for_fix?: boolean;
  repair_done?: boolean;
  verified?: boolean;
}): TaskResult {
  return isResolvedFault(t) ? TaskResult.OK : t.result;
}

/**
 * The בד״ח number as shown in the report footer. Uses the number the performer
 * entered (the serial we already defined, e.g. "מערכת אלפא-03-000026"); when it
 * is empty, falls back to the frozen system/unit snapshot so the footer is never
 * blank. This does NOT generate or alter the number — display only.
 */
export function formFooterNumber(
  form: Pick<CompletedForm, 'number' | 'system_name_snapshot' | 'unit_name_snapshot' | 'name'>
): string {
  if (form.number?.trim()) return form.number.trim();
  const parts = [form.system_name_snapshot, form.unit_name_snapshot].filter(Boolean);
  return parts.length ? parts.join('-') : form.name || '—';
}
