import type { CalibrationView } from '@/services/calibration';
import { formatDateDots } from '@/exports/labels';
import { Icon } from './Icon';

/**
 * A small, subtle read-only line shown under a required-calibration equipment
 * item: "מס׳ סידורי: … | תוקף כיול: …" + a validity badge (כיול בתוקף / תוקף
 * הכיול פג) computed against the inspection date. Shows the data the PERFORMER
 * entered. Renders nothing for items that do not require calibration.
 * Light-only (safe for PDF/print).
 */
export function EquipmentCalibrationLine({ view, compact = false }: { view: CalibrationView; compact?: boolean }) {
  if (!view.required) return null;
  const { serial, expiry, state } = view;
  const expired = state === 'expired';
  const entered = !!(serial || expiry);
  const parts: string[] = [];
  if (serial) parts.push(`מס׳ סידורי: ${serial}`);
  if (expiry) parts.push(`תוקף כיול: ${formatDateDots(expiry)}`);
  return (
    <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${compact ? 'text-[10.5px]' : 'text-[11px]'}`}>
      <span className="italic text-slate-500">{entered ? parts.join(' | ') : 'דורש כיול — טרם הוזן'}</span>
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
        {state === 'valid' ? 'כיול בתוקף' : expired ? 'תוקף הכיול פג' : 'דורש כיול'}
      </span>
    </div>
  );
}
