import type { CalibrationState, EquipmentCalibration } from '@/types';

/**
 * Pure calibration helpers (no DB, no UI) — trivially unit-testable.
 *
 * A calibration is judged against a REFERENCE DATE (the בד״ח inspection date).
 * Both the expiry and the form date are frozen on the completed בד״ח, so the
 * result is stable forever — a later admin edit never changes a historical form.
 */

/** Normalize a date-ish value to a YYYY-MM-DD string for safe lexical compare. */
function dateOnly(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Accept full ISO or plain date; keep only the date part.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
}

/**
 * Validity of a single calibration as of `onDate`:
 *   • 'unknown'  — no expiry recorded (cannot judge)
 *   • 'valid'    — expiry is on/after the inspection date
 *   • 'expired'  — expiry is before the inspection date
 * The expiry day itself counts as still valid (inclusive).
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
  return state === 'valid' ? 'בתוקף' : state === 'expired' ? 'תוקף הכיול פג' : 'ללא תוקף';
}

/** The calibration entries that actually require calibration, with their item name. */
export function calibratedItems(
  items: string[] | undefined,
  calibration: (EquipmentCalibration | null)[] | undefined
): { name: string; cal: EquipmentCalibration }[] {
  if (!items || !calibration) return [];
  const out: { name: string; cal: EquipmentCalibration }[] = [];
  items.forEach((name, i) => {
    const c = calibration[i];
    if (c && c.requires_calibration) out.push({ name, cal: c });
  });
  return out;
}

/**
 * True when a task carries at least one required-calibration item whose
 * calibration is EXPIRED as of `onDate`. Drives the warning / block policy.
 */
export function taskHasExpiredCalibration(
  task: {
    equipment_items_snapshot?: string[];
    equipment_calibration_snapshot?: (EquipmentCalibration | null)[];
  },
  onDate: string
): boolean {
  return calibratedItems(task.equipment_items_snapshot, task.equipment_calibration_snapshot).some(
    ({ cal }) => calibrationState(cal.calibration_expiry, onDate) === 'expired'
  );
}
