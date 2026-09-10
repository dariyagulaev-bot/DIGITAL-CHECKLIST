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
