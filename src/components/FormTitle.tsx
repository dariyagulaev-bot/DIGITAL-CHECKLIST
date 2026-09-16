import type { CompletedForm } from '@/types';
import { formatDateDots } from '@/exports/labels';

/**
 * The בד״ח's automatic, fixed title — the same one shown on the form itself and
 * in the report: "שם המערכת | מספר המערכת | תאריך". Each field is bidi-isolated
 * so the date never bleeds into the system-number field in the RTL layout.
 * Used in list cards instead of the (internal) template name.
 */
export function FormTitle({ form, className = '' }: { form: CompletedForm; className?: string }) {
  return (
    <div dir="rtl" className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${className}`}>
      {form.system_name_snapshot && <bdi>{form.system_name_snapshot}</bdi>}
      {form.unit_name_snapshot && (
        <>
          <span className="font-normal text-slate-300">|</span>
          <span>
            מספר מערכת <bdi>{form.unit_name_snapshot}</bdi>
          </span>
        </>
      )}
      <span className="font-normal text-slate-300">|</span>
      <bdi>{formatDateDots(form.date)}</bdi>
    </div>
  );
}
