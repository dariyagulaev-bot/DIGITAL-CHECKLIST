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
        /* Professional measurement results table — inputs + VERO-computed rows
           + final verdict, in one clean official table (screen + PDF). */
        <ProMeasureTable
          config={config}
          cells={cells}
          editable={editable}
          full={full}
          timerMode={timerMode}
          startedAt={startedAt}
          endedAt={endedAt}
          onChange={(colId, v) => setCell(theRowId, colId, v)}
        />
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
      {!fieldMode && editable && full.status && (
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
      {!fieldMode && !editable && config.duration && !timerMode && (
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
      {!fieldMode && !editable && (config.rules ?? []).length > 0 && (
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
      {!fieldMode && !editable && full.status && (
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

/** Format a measured value for the read-only report by its field type. */
function fmtFieldValue(fieldType: FieldType, raw: string): string {
  const t = Date.parse(raw);
  const p = (n: number) => String(n).padStart(2, '0');
  if (fieldType === 'datetime' && Number.isFinite(t)) {
    const d = new Date(t);
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  if (fieldType === 'date' && Number.isFinite(t)) {
    const d = new Date(t);
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
  return raw;
}

/** Compact datetime display: "DD.MM HH:MM" (date shown; mainly for the record). */
function fmtDT(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function CellInput({
  type,
  column,
  value,
  editable,
  onChange,
  plain = false,
}: {
  type: FieldType;
  column: TableColumn;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
  /** plain = drop the component's own border/bg so a parent (.pro-mtbl) styles it. */
  plain?: boolean;
}) {
  const base = plain
    ? 'w-full min-w-0 nums'
    : 'w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13.5px] text-ink-900 focus:border-brand-400 focus:outline-none';
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

/** Status pill (✓ תקין / ✕ חריגה / ממתין). */
function Pill({ status }: { status: 'pass' | 'fail' | 'pend' }) {
  if (status === 'pass') return <span className="mt-pill pass">✓ תקין</span>;
  if (status === 'fail') return <span className="mt-pill fail">✕ חריגה</span>;
  return <span className="mt-pill pend">ממתין</span>;
}

/**
 * The professional measurement results table (field-layout). One clean 4-column
 * table — נתון · ערך שנמדד · דרישה · תוצאה — that lays out the measured inputs,
 * then the VERO-computed rows (difference / duration) on a tinted band, then a
 * prominent final verdict. Shared by execution (editable inputs) and the
 * read-only report/PDF, so both always match.
 */
function ProMeasureTable({
  config,
  cells,
  editable,
  full,
  timerMode,
  startedAt,
  endedAt,
  onChange,
}: {
  config: TableConfig;
  cells: Record<string, string>;
  editable: boolean;
  full: ReturnType<typeof evaluateTableFull>;
  timerMode: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
  onChange: (colId: string, value: string) => void;
}) {
  const theRowId = config.rows[0]?.id ?? '';
  const results = full.results;
  const dur = full.duration_result;
  const colLabel = (id: string) => config.columns.find((c) => c.id === id)?.label ?? '';
  const unitOf = (fieldId: string) => {
    const c = config.columns.find((x) => x.id === fieldId);
    return c && NUMERIC_UNIT.includes(c.field_type) ? (c.unit ?? '').trim() : '';
  };
  const signed = (n: number | null | undefined) => (n === null || n === undefined ? '' : n > 0 ? `+${n}` : `${n}`);

  // Measured-input rows (what the performer fills).
  const inputCols = config.columns;

  // VERO-computed rows.
  type Calc = { label: string; value: string; req: string; status: 'pass' | 'fail' | 'pend' | 'none'; note?: string; readonly?: boolean };
  const calc: Calc[] = [];
  for (const rule of config.rules ?? []) {
    const res = results.find((r) => r.rule_id === rule.id);
    const u = unitOf(rule.final.col_id) || unitOf(rule.initial.col_id);
    const status: Calc['status'] = !res || res.passed === null ? 'pend' : res.passed ? 'pass' : 'fail';
    calc.push({
      label: (config.rules ?? []).length > 1 ? `הפרש · ${colLabel(rule.final.col_id)}` : 'הפרש',
      value: res?.difference === null || res?.difference === undefined ? '—' : `${signed(res.difference)}${u ? ` ${u}` : ''}`,
      req: `עד ±${rule.allowed_difference}${u ? ` ${u}` : ''}`,
      status,
    });
  }
  if (config.duration) {
    if (timerMode) {
      calc.push({ label: 'שעת התחלה', value: startedAt ? fmtDT(startedAt) : '—', req: '', status: 'none', readonly: true });
      calc.push({ label: 'שעת סיום', value: endedAt ? fmtDT(endedAt) : '—', req: '', status: 'none', readonly: true });
    }
    const min = dur?.min_minutes ?? config.duration.min_minutes ?? null;
    const status: Calc['status'] = dur?.invalid ? 'fail' : dur?.passed === null || dur?.passed === undefined ? 'pend' : dur.passed ? 'pass' : 'fail';
    calc.push({
      label: 'משך הבדיקה',
      value: dur?.actual_minutes === null || dur?.actual_minutes === undefined ? '—' : formatDuration(dur.actual_minutes),
      req: min !== null ? `מינימום ${formatDuration(min)}` : '',
      status,
      note: dur?.invalid ? 'זמן סיום מוקדם מהתחלה' : undefined,
    });
  }

  const finalStatus = full.status; // 'pass' | 'fail' | 'incomplete' | undefined
  const finalText = finalStatus === 'pass' ? 'עבר בדיקה' : finalStatus === 'fail' ? 'לא עבר בדיקה' : 'טרם הושלמה';

  return (
    <div className="overflow-x-auto">
      <table className="pro-mtbl">
        <thead>
          <tr>
            <th>נתון</th>
            <th>ערך שנמדד</th>
            <th>דרישה</th>
            <th className="th-c">תוצאה</th>
          </tr>
        </thead>
        <tbody>
          {inputCols.map((c) => {
            const required = !!(config.required || c.required);
            const raw = (cells[key(theRowId, c.id)] ?? '').trim();
            const u = unitOf(c.id);
            return (
              <tr key={c.id}>
                <td className="c-label">
                  {c.label}
                  {required && <span className="text-fault-500"> *</span>}
                </td>
                <td className="c-val">
                  {editable ? (
                    <CellInput type={c.field_type} column={c} value={cells[key(theRowId, c.id)] ?? ''} editable plain onChange={(v) => onChange(c.id, v)} />
                  ) : raw ? (
                    <>
                      <bdi>{fmtFieldValue(c.field_type, raw)}</bdi>
                      {u ? <span className="c-dim"> {u}</span> : null}
                    </>
                  ) : (
                    <span className="c-dim">—</span>
                  )}
                </td>
                <td className="c-req c-dim">—</td>
                <td className="c-res c-dim">—</td>
              </tr>
            );
          })}

          {calc.length > 0 && (
            <tr className="grp">
              <td colSpan={4}>מחושב אוטומטית ע״י VERO</td>
            </tr>
          )}
          {calc.map((row, i) => (
            <tr key={i} className={`calc ${row.status === 'fail' ? 'row-fail' : ''}`}>
              <td className="c-label">{row.label}</td>
              <td className="c-val">
                {row.value === '—' ? <span className="c-dim">—</span> : <bdi>{row.value}</bdi>}
              </td>
              <td className="c-req">{row.req || <span className="c-dim">—</span>}</td>
              <td className="c-res">
                {row.readonly || row.status === 'none' ? (
                  <span className="c-dim">—</span>
                ) : (
                  <Pill status={row.status} />
                )}
              </td>
            </tr>
          ))}

          {finalStatus && (
            <tr className="final">
              <td className="c-label">תוצאה סופית</td>
              <td colSpan={3}>
                <span className={`mt-final ${finalStatus === 'incomplete' ? 'pend' : finalStatus}`}>
                  {finalStatus === 'pass' ? '✓' : finalStatus === 'fail' ? '✕' : '⏳'} {finalText}
                </span>
                {finalStatus === 'fail' && full.fail_reasons.length > 0 && (
                  <span className="mr-3 text-[12.5px] font-semibold text-fault-700">
                    — {full.fail_reasons.join(' · ')}
                  </span>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export { cellKey };
