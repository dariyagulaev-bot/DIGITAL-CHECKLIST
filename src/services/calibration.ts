import type { CalibrationEntry, CalibrationState, EquipmentCalibration } from '@/types';

/**
 * Pure calibration helpers (no DB, no UI) — trivially unit-testable.
 *
 * Model: the ADMIN flags which equipment REQUIRES calibration (a boolean per
 * item). The PERFORMER enters the serial number + calibration expiry of the
 * physical item actually used, at execution time. Both the requirement and the
 * performer's entry are frozen on the completed בד״ח, so the validity (expiry vs
 * the inspection date) is stable forever.
 */

/** Normalize a date-ish value to a YYYY-MM-DD string for safe lexical compare. */
function dateOnly(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
}

/**
 * Validity of a calibration as of `onDate`:
 *   • 'unknown'  — no expiry recorded yet
 *   • 'valid'    — expiry on/after the inspection date (the day itself counts)
 *   • 'expired'  — expiry before the inspection date
 */
export function calibrationState(
  expiry: string | null | undefined,
  onDate: string
): CalibrationState {
  const exp = dateOnly(expiry);
  const ref = dateOnly(onDate);
  if (!exp || !ref) return 'unknown';
  return exp >= ref ? 'valid' : 'expired';
}

export function calibrationStateLabel(state: CalibrationState): string {
  return state === 'valid' ? 'כיול בתוקף' : state === 'expired' ? 'תוקף הכיול פג' : 'ללא תוקף';
}

/** Merged view of one equipment item: admin requirement + performer entry + state. */
export interface CalibrationView {
  index: number;
  name: string;
  required: boolean;
  serial?: string;
  expiry?: string;
  state: CalibrationState; // meaningful only when `required`
  entered_by_name?: string;
  entered_at?: string;
}

interface TaskLike {
  equipment_items_snapshot?: string[];
  equipment_calibration_snapshot?: (EquipmentCalibration | null)[]; // admin requirement
  equipment_calibration_entries?: (CalibrationEntry | null)[]; // performer entry
}

/** One merged view per equipment item of a task. */
export function taskCalibrationViews(task: TaskLike, onDate: string): CalibrationView[] {
  const items = task.equipment_items_snapshot ?? [];
  const req = task.equipment_calibration_snapshot ?? [];
  const entries = task.equipment_calibration_entries ?? [];
  return items.map((name, i) => {
    const required = !!req[i]?.requires_calibration;
    const e = entries[i] ?? null;
    return {
      index: i,
      name,
      required,
      serial: e?.serial_number || undefined,
      expiry: e?.calibration_expiry || undefined,
      state: required ? calibrationState(e?.calibration_expiry, onDate) : 'unknown',
      entered_by_name: e?.entered_by_name,
      entered_at: e?.entered_at,
    };
  });
}

/** True when a task has at least one required item whose entered calibration is expired. */
export function taskHasExpiredCalibration(task: TaskLike, onDate: string): boolean {
  return taskCalibrationViews(task, onDate).some((v) => v.required && v.state === 'expired');
}

/** Required-calibration items that are still missing a serial number or expiry. */
export function taskMissingCalibrationEntry(task: TaskLike): string[] {
  const items = task.equipment_items_snapshot ?? [];
  const req = task.equipment_calibration_snapshot ?? [];
  const entries = task.equipment_calibration_entries ?? [];
  const missing: string[] = [];
  items.forEach((name, i) => {
    if (!req[i]?.requires_calibration) return;
    const e = entries[i];
    if (!e?.serial_number?.trim() || !e?.calibration_expiry) missing.push(name);
  });
  return missing;
}
