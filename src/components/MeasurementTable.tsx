import { useMemo } from 'react';
import { Icon } from './Icon';
import { cellKey, evaluateTable, allowedRange, tableFailStatus } from '@/services/measurements';
import type { FieldType, MeasurementResult, TableColumn, TableConfig } from '@/types';

const key = (rowId: string, colId: string) => `${rowId}|${colId}`;

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
}: {
  config: TableConfig;
  cells: Record<string, string>;
  editable: boolean;
  onChange?: (next: Record<string, string>) => void;
}) {
  const results = useMemo(() => evaluateTable(config, cells), [config, cells]);
  const derived = tableFailStatus(config, results);
  const rowLabel = (id: string) => config.rows.find((r) => r.id === id)?.label ?? '';
  const colLabel = (id: string) => config.columns.find((c) => c.id === id)?.label ?? '';

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

      {/* ±X rule results */}
      {(config.rules ?? []).length > 0 && (
        <div className="mt-2 space-y-1.5">
          {(config.rules ?? []).map((rule) => {
            const res = results.find((x) => x.rule_id === rule.id) as MeasurementResult | undefined;
            const range = res && res.initial !== null ? allowedRange(res.initial, rule.allowed_difference) : null;
            const decided = res && res.passed !== null;
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
                  <span>שדה התחלתי (<bdi>{rowLabel(rule.initial.row_id)} · {colLabel(rule.initial.col_id)}</bdi>): <b className="nums">{res?.initial ?? '—'}</b></span>
                  <span>שדה סופי (<bdi>{rowLabel(rule.final.row_id)} · {colLabel(rule.final.col_id)}</bdi>): <b className="nums">{res?.final ?? '—'}</b></span>
                  <span>פער בפועל: <b className="nums">{res?.difference ?? '—'}</b></span>
                  <span>פער מותר: <b className="nums">±{rule.allowed_difference}</b></span>
                  {range && <span>טווח תקין: <b className="nums">{range.min}–{range.max}</b></span>}
                  <span className="font-bold">
                    תוצאה:{' '}
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
          {derived === false && (
            <div className="flex items-center gap-1.5 rounded-lg border border-fault-300 bg-fault-50 px-3 py-1.5 text-[13px] font-bold text-fault-700">
              <Icon name="alert" size={15} /> הבדיקה לא תקינה — חריגה מהפער המותר
            </div>
          )}
          {derived === true && (
            <div className="flex items-center gap-1.5 rounded-lg border border-ok-200 bg-ok-50 px-3 py-1.5 text-[13px] font-bold text-ok-700">
              <Icon name="check" size={15} /> הבדיקה תקינה — בתוך הפער המותר
            </div>
          )}
        </div>
      )}
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
