import type { EquipmentCalibration } from '@/types';
import { calibrationState } from '@/services/calibration';
import { formatDateDots } from '@/exports/labels';
import { Icon } from './Icon';

/**
 * A small, subtle line shown directly under a required-equipment item that
 * requires calibration: "מס׳ סידורי: … | תוקף כיול: …" plus a validity badge
 * (בתוקף / תוקף הכיול פג) computed against the inspection date. Renders nothing
 * when the item does not require calibration. Light-only (safe for PDF/print).
 */
export function EquipmentCalibrationLine({
  cal,
  date,
  compact = false,
}: {
  cal: EquipmentCalibration | null | undefined;
  date: string;
  compact?: boolean;
}) {
  if (!cal?.requires_calibration) return null;
  const state = calibrationState(cal.calibration_expiry, date);
  const expired = state === 'expired';
  const parts: string[] = [];
  if (cal.serial_number) parts.push(`מס׳ סידורי: ${cal.serial_number}`);
  if (cal.calibration_expiry) parts.push(`תוקף כיול: ${formatDateDots(cal.calibration_expiry)}`);
  return (
    <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${compact ? 'text-[10.5px]' : 'text-[11px]'}`}>
      <span className="italic text-slate-500">{parts.join(' | ') || 'דורש כיול'}</span>
      <span
        className={`inline-flex items-center gap-0.5 rounded px-1.5 py-[1px] font-semibold ${
          expired
            ? 'bg-fault-100 text-fault-700'
            : state === 'valid'
              ? 'bg-ok-100 text-ok-700'
              : 'bg-slate-100 text-slate-500'
        }`}
      >
        {expired && <Icon name="alert" size={11} />}
        {state === 'valid' ? 'בתוקף' : expired ? 'תוקף הכיול פג' : 'כיול'}
      </span>
    </div>
  );
}
