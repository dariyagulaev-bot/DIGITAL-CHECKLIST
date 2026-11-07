import { useMemo, type CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { CellInput } from './MeasurementTable';
import { evaluateGrid } from '@/services/measurements';
import type { TableColumn, TableConfig, TableStyle } from '@/types';

const key = (rowId: string, colId: string) => `${rowId}|${colId}`;
const INPUT_TYPES = new Set(['short_text', 'long_text', 'number', 'decimal', 'percent', 'time', 'date', 'datetime', 'bool', 'select', 'multiselect']);

/** "HH:MM" from a minute count (compact duration for a grid cell). */
function fmtHM(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—';
  const neg = minutes < 0 ? '-' : '';
  const m = Math.abs(Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m - h * 60;
  return `${neg}${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Map the admin's TableStyle to CSS custom properties (falls back to VERO defaults). */
function styleVars(s?: TableStyle): CSSProperties {
  const v: Record<string, string> = {};
  if (!s) return v;
  if (s.head_bg) v['--mt-head-bg'] = s.head_bg;
  if (s.head_text) v['--mt-head-text'] = s.head_text;
  if (s.row_bg) v['--mt-surface'] = s.row_bg;
  if (s.alt_row_bg) v['--mt-alt-row'] = s.alt_row_bg;
  if (s.text) v['--mt-text'] = s.text;
  if (s.border) v['--mt-border'] = s.border;
  if (s.border_width !== undefined) v['--mt-bw'] = `${s.border_width}px`;
  if (s.font_size !== undefined) v['--mt-font'] = `${s.font_size}px`;
  if (s.bold_head === false) v['--mt-head-weight'] = '500';
  if (s.align) v['--mt-align'] = s.align;
  if (s.row_height !== undefined) v['--mt-row-h'] = `${s.row_height}px`;
  if (s.pass_color) v['--mt-pass-text'] = s.pass_color;
  if (s.fail_color) {
    v['--mt-fail-text'] = s.fail_color;
    v['--mt-fail-row'] = `color-mix(in srgb, ${s.fail_color} 10%, var(--mt-surface))`;
  }
  return v as CSSProperties;
}

/**
 * Sub-system measurement grid — rows are sub-systems, columns are admin-defined
 * fields that may include auto-computed difference / duration columns and a
 * per-row result (✓ עבר / ✕ לא עבר + reason). Reuses the shared measurement
 * engine (evaluateGrid). The performer sees a clean table and only fills inputs;
 * calc and result cells are read-only. Styles come from config.style (VERO
 * defaults otherwise). Renders identically on screen, in the report and in PDF.
 */
export function SubsystemGrid({
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
  const grid = useMemo(() => evaluateGrid(config, cells), [config, cells]);
  const resById = useMemo(() => Object.fromEntries(grid.map((g) => [g.row_id, g])), [grid]);
  const setCell = (rowId: string, colId: string, value: string) => {
    if (editable && onChange) onChange({ ...cells, [key(rowId, colId)]: value });
  };

  const headCols = config.columns;
  const rowHeader = config.row_header_label || 'תת מערכת';

  const renderCell = (col: TableColumn, rowId: string) => {
    const g = resById[rowId];
    if (col.field_type === 'result') {
      const p = g?.pass;
      return (
        <>
          <span className={`mt-pill ${p === null || p === undefined ? 'pend' : p ? 'pass' : 'fail'}`}>
            {p === null || p === undefined ? 'ממתין' : p ? '✓ עבר' : '✕ לא עבר'}
          </span>
          {p === false && g && g.reasons.length > 0 && <span className="grid-reason">{g.reasons.join(' · ')}</span>}
        </>
      );
    }
    if (col.field_type === 'calc') {
      const val = g?.calc[col.id];
      if (val === null || val === undefined) return <span className="c-dim">—</span>;
      return <bdi>{col.calc?.kind === 'duration' ? fmtHM(val) : `${val}`}</bdi>;
    }
    // Input columns.
    const raw = (cells[key(rowId, col.id)] ?? '').trim();
    if (editable && INPUT_TYPES.has(col.field_type)) {
      return <CellInput type={col.field_type} column={col} value={cells[key(rowId, col.id)] ?? ''} editable plain onChange={(v) => setCell(rowId, col.id, v)} />;
    }
    if (!raw) return <span className="c-dim">—</span>;
    const unit = col.unit && ['number', 'decimal', 'percent'].includes(col.field_type) ? ` ${col.unit}` : '';
    return (
      <>
        <bdi>{raw}</bdi>
        {unit ? <span className="c-dim">{unit}</span> : null}
      </>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="grid-mtbl" style={styleVars(config.style)}>
        <thead>
          <tr>
            <th>{rowHeader}</th>
            {headCols.map((col) => (
              <th key={col.id} className={col.field_type === 'result' ? 'res-col' : ''} style={{ width: col.width ? `${col.width}px` : undefined, textAlign: col.align }}>
                {col.icon && <span className="thd-ic"><Icon name={col.icon as IconName} size={13} /></span>}
                {col.label}
                {(config.required || col.required) && col.field_type !== 'calc' && col.field_type !== 'result' && <span className="text-fault-300"> *</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.rows.map((row) => {
            const g = resById[row.id];
            return (
              <tr key={row.id} className={g?.pass === false ? 'row-fail' : ''}>
                <td>{row.label || '—'}</td>
                {headCols.map((col) => (
                  <td
                    key={col.id}
                    className={col.field_type === 'calc' ? 'calc' : col.field_type === 'result' ? 'res-col' : ''}
                    style={{ textAlign: col.align ?? (col.field_type === 'short_text' || col.field_type === 'long_text' ? 'right' : 'center') }}
                  >
                    {renderCell(col, row.id)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
