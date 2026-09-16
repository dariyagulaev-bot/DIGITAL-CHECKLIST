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
      return 'נדחה / דורש תיקון';
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
