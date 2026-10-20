import { useMemo } from 'react';
import { Icon } from './Icon';
import { cellKey, evaluateTableFull, allowedRange, formatDuration } from '@/services/measurements';
import type { FieldType, MeasurementResult, TableColumn, TableConfig } from '@/types';

const key = (rowId: string, colId: string) => `${rowId}|${colId}`;
/** Field types that carry a unit of measure (shown next to the value). */
const NUMERIC_UNIT: FieldType[] = ['number', 'decimal', 'percent'];

/**
 * Measurement / data table — rendered at execution time (editable) and in the
 * report/PDF (read-only). Cells are typed inputs; ±X rules compute live and the
 * table's derived תקין/לא תקין status is shown (and can't be overridden). Fully
 * RTL, touch/stylus/mouse friendly; wide tables scroll horizontally.
 */
export function MeasurementTable({
  config,
  cells,
  editable,
  onChange,
  startedAt,
  endedAt,
  onTimer,
}: {
  config: TableConfig;
  cells: Record<string, string>;
  editable: boolean;
  onChange?: (next: Record<string, string>) => void;
  startedAt?: string | null;
  endedAt?: string | null;
  onTimer?: (action: 'start' | 'stop' | 'reset') => void;
}) {
  const full = useMemo(
    () => evaluateTableFull(config, cells, { started_at: startedAt, ended_at: endedAt }),
    [config, cells, startedAt, endedAt]
  );
  const results = full.results;
  const dur = full.duration_result;
  // A timer-mode duration uses Start/Stop device-clock stamps (no datetime cells).
  const timerMode = !!config.duration && config.duration.mode !== 'fields' && !config.duration.start && !config.duration.end;
  // Field layout: a flat vertical list of labeled fields (vs. the legacy grid).
  const fieldMode = config.layout === 'fields';
  const theRowId = config.rows[0]?.id ?? '';
  const unitOf = (fieldId?: string) => {
    const c = fieldId ? config.columns.find((x) => x.id === fieldId) : undefined;
    return c && NUMERIC_UNIT.includes(c.field_type) ? (c.unit ?? '').trim() : '';
  };
  // Signed differences (direction matters) + the field's unit, for the summary.
  const signedGap = (n: number | null | undefined) =>
    n === null || n === undefined ? '' : n > 0 ? `+${n}` : `${n}`;
  const gapText = results
    .map((r) => {
      const s = signedGap(r.difference);
      if (!s) return '';
      const rule = (config.rules ?? []).find((x) => x.id === r.rule_id);
      const unit = rule ? unitOf(rule.final.col_id) || unitOf(rule.initial.col_id) : '';
      return unit ? `${s} ${unit}` : s;
    })
    .filter(Boolean)
    .join(', ');
  const rowLabel = (id: string) => config.rows.find((r) => r.id === id)?.label ?? '';
  const colLabel = (id: string) => config.columns.find((c) => c.id === id)?.label ?? '';
  const dtCell = (ref?: { row_id: string; col_id: string }) =>
    !ref ? '' : fieldMode ? colLabel(ref.col_id) : `${rowLabel(ref.row_id)} · ${colLabel(ref.col_id)}`;

  const setCell = (rowId: string, colId: string, value: string) => {
    if (!editable || !onChange) return;
    onChange({ ...cells, [key(rowId, colId)]: value });
  };

  return (
    <div className="measure-table">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15px] font-bold text-ink-900">{config.title}</div>
        {config.duration_label && (
          <div className="text-[12.5px] font-medium text-ink-500">משך בדיקה נדרש: {config.duration_label}</div>
        )}
      </div>
      {config.description && <p className="mb-2 text-[13px] text-ink-500">{config.description}</p>}

      {fieldMode ? (
        /* Simplified field layout: a clean vertical list of labeled inputs. */
        <div className="space-y-2.5">
          {config.columns.map((c) => (
            <FieldRow
              key={c.id}
              field={c}
              value={cells[key(theRowId, c.id)] ?? ''}
              required={!!(config.required || c.required)}
              editable={editable}
              onChange={(v) => setCell(theRowId, c.id, v)}
            />
          ))}
        </div>
      ) : (
        /* Legacy row × column grid. */
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-right text-[13.5px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 p-2 font-semibold text-ink-600"></th>
                {config.columns.map((c) => (
                  <th key={c.id} className="border border-slate-200 p-2 font-semibold text-ink-700">
                    {c.label}
                    {c.unit ? <span className="text-ink-400"> ({c.unit})</span> : null}
                    {(config.required || c.required) && <span className="text-fault-500"> *</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.rows.map((r) => (
                <tr key={r.id}>
                  <th className="border border-slate-200 bg-slate-50/60 p-2 text-right font-semibold text-ink-700">{r.label}</th>
                  {config.columns.map((c) => (
                    <td key={c.id} className="border border-slate-200 p-1.5">
                      <CellInput
                        type={c.field_type}
                        column={c}
                        value={cells[key(r.id, c.id)] ?? ''}
                        editable={editable}
                        onChange={(v) => setCell(r.id, c.id, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/*
        Minimum-duration timer (timer mode): the performer presses "התחל דגימה"
        and "סיום דגימה"; the device clock is stamped at each press. The duration
        and PASS/FAIL are derived from those stamps — the configured minimum is
        still enforced (actual ≥ min). No datetime fields to fill or pick.
      */}
      {timerMode && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-ink-700">דגימת זמן מדידה</span>
            <span className="text-[12px] text-ink-500">משך מינימלי נדרש: <b>{formatDuration(config.duration?.min_minutes ?? null)}</b></span>
          </div>
          {editable ? (
            <div className="flex flex-wrap items-center gap-2">
              {!startedAt ? (
                <button type="button" className="btn-primary btn-sm gap-1.5" onClick={() => onTimer?.('start')}>
                  <Icon name="clock" size={15} /> התחל דגימה
                </button>
              ) : !endedAt ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-ok-50 px-2 py-1 text-[12.5px] font-medium text-ok-700">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-ok-500" /> דגימה פעילה · התחלה {fmtDT(startedAt)}
                  </span>
                  <button type="button" className="btn-primary btn-sm gap-1.5" onClick={() => onTimer?.('stop')}>
                    <Icon name="check" size={15} /> סיום דגימה
                  </button>
                  <button type="button" className="btn-ghost btn-sm text-ink-500" onClick={() => onTimer?.('reset')}>אפס</button>
                </>
              ) : (
                <>
                  <span className="text-[12.5px] text-ink-600">התחלה: <b className="nums">{fmtDT(startedAt)}</b></span>
                  <span className="text-[12.5px] text-ink-600">סיום: <b className="nums">{fmtDT(endedAt)}</b></span>
                  <span className="text-[12.5px] text-ink-600">משך בפועל: <b>{formatDuration(dur?.actual_minutes ?? null)}</b></span>
                  <button type="button" className="btn-ghost btn-sm gap-1.5 text-ink-500" onClick={() => onTimer?.('start')}>
                    <Icon name="clock" size={14} /> דגימה חדשה
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-600">
              <span>התחלה: <b className="nums">{startedAt ? fmtDT(startedAt) : '—'}</b></span>
              <span>סיום: <b className="nums">{endedAt ? fmtDT(endedAt) : '—'}</b></span>
              <span>משך בפועל: <b>{dur?.actual_minutes === null || dur?.actual_minutes === undefined ? '—' : formatDuration(dur.actual_minutes)}</b></span>
            </div>
          )}
        </div>
      )}

      {/*
        Execution view: a single compact pass/fail summary with the actual
        signed gap — no duration/ranges/times/endpoints/calc steps. All full
        data stays persisted for the record, Audit, PDF and Excel. The detailed
        breakdown below renders only in the read-only report/documentation view.
      */}
      {editable && full.status && (
        <div
          className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-[13px] font-bold ${
            full.status === 'fail'
              ? 'border-fault-300 bg-fault-50 text-fault-700'
              : full.status === 'pass'
                ? 'border-ok-300 bg-ok-50 text-ok-700'
                : 'border-slate-200 bg-slate-50 text-ink-500'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {full.status === 'fail' ? (
              <Icon name="alert" size={15} />
            ) : full.status === 'pass' ? (
              <Icon name="check" size={15} />
            ) : (
              <Icon name="clock" size={15} />
            )}
            {full.status === 'fail'
              ? 'הבדיקה נכשלה'
              : full.status === 'pass'
                ? 'הבדיקה עברה בהצלחה'
                : 'הבדיקה טרם הושלמה'}
          </span>
          {full.status !== 'incomplete' && gapText && (
            <>
              <span className="font-normal text-ink-300">|</span>
              <span className="font-semibold">
                פער: <bdi dir="ltr" className="nums">{gapText}</bdi>
              </span>
            </>
          )}
        </div>
      )}

      {/* Legacy field-mode duration detail (report / documentation view only) */}
      {!editable && config.duration && !timerMode && (
        <div
          className={`mt-2 rounded-lg border px-3 py-2 text-[12.5px] ${
            dur?.invalid || dur?.passed === false
              ? 'border-fault-200 bg-fault-50 text-ink-800'
              : dur?.passed
                ? 'border-ok-200 bg-ok-50 text-ink-700'
                : 'border-slate-200 bg-slate-50 text-ink-500'
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
            <span>התחלה (<bdi>{dtCell(config.duration.start)}</bdi>): <b className="nums">{dur?.start ? fmtDT(dur.start) : '—'}</b></span>
            <span>סיום (<bdi>{dtCell(config.duration.end)}</bdi>): <b className="nums">{dur?.end ? fmtDT(dur.end) : '—'}</b></span>
            <span>משך מינימלי נדרש: <b>{formatDuration(dur?.min_minutes ?? config.duration.min_minutes ?? null)}</b></span>
            <span>משך בפועל: <b>{dur?.actual_minutes === null || dur?.actual_minutes === undefined ? '—' : formatDuration(dur.actual_minutes)}</b></span>
            <span className="font-bold">
              {dur?.invalid ? (
                <span className="text-fault-700">✕ זמן סיום מוקדם מהתחלה</span>
              ) : dur?.passed === null || dur?.passed === undefined ? (
                <span className="text-ink-400">ממתין לנתונים</span>
              ) : dur.passed ? (
                <span className="text-ok-700">✓ עבר תנאי הזמן</span>
              ) : (
                <span className="text-fault-700">✕ משך קצר מהנדרש</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* ±X gap results (report / documentation view only) */}
      {!editable && (config.rules ?? []).length > 0 && (
        <div className="mt-2 space-y-1.5">
          {(config.rules ?? []).map((rule) => {
            const res = results.find((x) => x.rule_id === rule.id) as MeasurementResult | undefined;
            const range = res && res.initial !== null ? allowedRange(res.initial, rule.allowed_difference) : null;
            const decided = res && res.passed !== null;
            const u = unitOf(rule.final.col_id) || unitOf(rule.initial.col_id);
            const withU = (v: number | null | undefined) => (v === null || v === undefined ? '—' : u ? `${v} ${u}` : `${v}`);
            return (
              <div
                key={rule.id}
                className={`rounded-lg border px-3 py-2 text-[12.5px] ${
                  !decided
                    ? 'border-slate-200 bg-slate-50 text-ink-500'
                    : res!.passed
                      ? 'border-ok-200 bg-ok-50 text-ink-700'
                      : 'border-fault-200 bg-fault-50 text-ink-800'
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
                  <span>שדה התחלתי (<bdi>{dtCell(rule.initial)}</bdi>): <b className="nums">{withU(res?.initial ?? null)}</b></span>
                  <span>שדה סופי (<bdi>{dtCell(rule.final)}</bdi>): <b className="nums">{withU(res?.final ?? null)}</b></span>
                  <span>פער בפועל: <b className="nums">{withU(res?.difference ?? null)}</b></span>
                  <span>פער מותר: <b className="nums">±{rule.allowed_difference}{u ? ` ${u}` : ''}</b></span>
                  {range && <span>טווח תקין: <b className="nums">{range.min}–{range.max}{u ? ` ${u}` : ''}</b></span>}
                  <span className="font-bold">
                    {!decided ? (
                      <span className="text-ink-400">ממתין לנתונים</span>
                    ) : res!.passed ? (
                      <span className="text-ok-700">✓ עבר</span>
                    ) : (
                      <span className="text-fault-700">✕ לא עבר</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overall measurement result — duration + gap combined (report view only) */}
      {!editable && full.status && (
        <div
          className={`mt-2 rounded-lg border px-3 py-2 text-[13px] font-bold ${
            full.status === 'fail'
              ? 'border-fault-300 bg-fault-50 text-fault-700'
              : full.status === 'pass'
                ? 'border-ok-300 bg-ok-50 text-ok-700'
                : 'border-slate-200 bg-slate-50 text-ink-500'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {full.status === 'fail' ? (
              <Icon name="alert" size={15} />
            ) : full.status === 'pass' ? (
              <Icon name="check" size={15} />
            ) : (
              <Icon name="clock" size={15} />
            )}
            {full.status === 'fail' ? 'הבדיקה נכשלה' : full.status === 'pass' ? 'הבדיקה עברה' : 'טרם הושלמה'}
          </div>
          {full.status === 'fail' && full.fail_reasons.length > 0 && (
            <ul className="mt-1 list-disc pr-5 text-[12px] font-medium text-fault-700">
              {full.fail_reasons.map((rz, i) => (
                <li key={i}>{rz}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact datetime display: "DD.MM HH:MM" (date shown; mainly for the record). */
function fmtDT(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * One measurement field in the simplified field layout — a labeled input with
 * the unit shown next to the value (execution), or "label: value unit"
 * (read-only report / PDF). The unit is presentation only; the raw numeric
 * value is what gets stored and fed to the ±X math.
 */
function FieldRow({
  field,
  value,
  required,
  editable,
  onChange,
}: {
  field: TableColumn;
  value: string;
  required: boolean;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  const showUnit = !!(field.unit && field.unit.trim()) && NUMERIC_UNIT.includes(field.field_type);
  if (!editable) {
    const shown = value.trim();
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <span className="text-[13.5px] font-semibold text-ink-700">
          {field.label}
          {required && <span className="text-fault-500"> *</span>}
        </span>
        <span className="text-[13.5px] text-ink-900">
          {shown ? (
            <>
              <bdi className="nums">{shown}</bdi>
              {showUnit ? <span className="text-ink-500"> {field.unit}</span> : null}
            </>
          ) : (
            '—'
          )}
        </span>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <label className="mb-1 block text-[13px] font-semibold text-ink-700">
        {field.label}
        {required && <span className="text-fault-500"> *</span>}
      </label>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <CellInput type={field.field_type} column={field} value={value} editable onChange={onChange} />
        </div>
        {showUnit && <span className="shrink-0 text-[13px] font-medium text-ink-500">{field.unit}</span>}
      </div>
    </div>
  );
}

function CellInput({
  type,
  column,
  value,
  editable,
  onChange,
}: {
  type: FieldType;
  column: TableColumn;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  const base = 'w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13.5px] text-ink-900 focus:border-brand-400 focus:outline-none';
  if (!editable) {
    const shown = value.trim() || '—';
    return <span className="block px-1 py-1 text-ink-800 nums">{shown}</span>;
  }
  switch (type) {
    case 'long_text':
      return <textarea className={`${base} min-h-[52px]`} value={value} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
    case 'decimal':
    case 'percent':
      return <input type="number" step="any" inputMode="decimal" className={`${base} nums`} value={value} onChange={(e) => onChange(e.target.value)} />;
    case 'time':
      return <input type="time" className={`${base} nums`} value={value} onChange={(e) => onChange(e.target.value)} />;
    case 'date':
      return <input type="date" className={`${base} nums`} value={value} onChange={(e) => onChange(e.target.value)} />;
    case 'datetime':
      return <input type="datetime-local" className={`${base} nums`} value={value} onChange={(e) => onChange(e.target.value)} />;
    case 'bool':
      return (
        <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value=""></option>
          <option value="כן">כן</option>
          <option value="לא">לא</option>
        </select>
      );
    case 'select':
      return (
        <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value=""></option>
          {(column.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'multiselect': {
      const sel = new Set(value ? value.split('|') : []);
      const toggle = (o: string) => {
        const next = new Set(sel);
        next.has(o) ? next.delete(o) : next.add(o);
        onChange([...next].join('|'));
      };
      return (
        <div className="flex flex-wrap gap-1">
          {(column.options ?? []).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className={`rounded-full border px-2 py-0.5 text-[12px] ${sel.has(o) ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-300 text-ink-600'}`}
            >
              {o}
            </button>
          ))}
        </div>
      );
    }
    default:
      return <input type="text" className={base} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}

export { cellKey };
