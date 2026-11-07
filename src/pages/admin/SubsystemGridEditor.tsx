import { useMemo, useState } from 'react';
import { newId } from '@/services/ids';
import { updateBlockConfig } from '@/services/blocks';
import { Modal } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { SubsystemGrid } from '@/components/SubsystemGrid';
import { formatDuration } from '@/services/measurements';
import type { FieldType, TableColumn, TableConfig, TableStyle, TemplateBlock } from '@/types';

/* ---- choices ------------------------------------------------------------- */
const COL_TYPES: { value: FieldType; label: string }[] = [
  { value: 'short_text', label: 'טקסט' },
  { value: 'number', label: 'מספר' },
  { value: 'time', label: 'שעה' },
  { value: 'date', label: 'תאריך' },
  { value: 'select', label: 'בחירה מרשימה' },
  { value: 'bool', label: 'תקין / לא תקין' },
  { value: 'calc', label: 'חישוב אוטומטי' },
  { value: 'result', label: 'תוצאה (עבר/לא עבר)' },
];
const ICON_CHOICES: (IconName | '')[] = ['', 'clock', 'database', 'layers', 'file', 'alert', 'pen', 'shield-check', 'settings', 'search', 'check'];
const MIN_PRESETS = [30, 60, 180, 360];

/* ---- design presets ------------------------------------------------------ */
const PRESETS: { name: string; style?: TableStyle }[] = [
  { name: 'VERO קלאסי', style: undefined },
  { name: 'כחול רשמי', style: { head_bg: '#1d4ed8', head_text: '#ffffff', border: '#c7d7f5' } },
  { name: 'אפור נקי', style: { head_bg: '#e9edf3', head_text: '#1c2430', border: '#d3dae4', bold_head: true } },
  { name: 'כהה', style: { head_bg: '#0b1830', head_text: '#e6edf7', row_bg: '#111d33', text: '#dce4f0', border: '#223049', alt_row_bg: '#0e1a30' } },
];

function reorder<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Build small sample data so the preview shows a passing + a failing row. */
function sampleCells(cfg: TableConfig): Record<string, string> {
  const cells: Record<string, string> = {};
  const [pass, fail] = cfg.rows;
  for (const col of cfg.columns) {
    if (col.field_type !== 'calc' || !col.calc) continue;
    const { from, to, kind } = col.calc;
    if (kind === 'difference') {
      const allowed = Math.abs(col.allowed_difference ?? 10);
      if (pass) { cells[`${pass.id}|${from}`] = '1000'; cells[`${pass.id}|${to}`] = String(1000 + Math.min(allowed, Math.max(1, allowed - 5))); }
      if (fail) { cells[`${fail.id}|${from}`] = '1000'; cells[`${fail.id}|${to}`] = String(1000 + allowed + 10); }
    } else {
      const min = col.min_minutes ?? 60;
      const hm = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      if (pass) { cells[`${pass.id}|${from}`] = '08:00'; cells[`${pass.id}|${to}`] = hm(8 * 60 + min + 20); }
      if (fail) { cells[`${fail.id}|${from}`] = '08:00'; cells[`${fail.id}|${to}`] = hm(8 * 60 + Math.max(10, min - 30)); }
    }
  }
  return cells;
}

export function SubsystemGridEditor({ block, onClose, onSaved }: { block: TemplateBlock; onClose: () => void; onSaved: () => void }) {
  const [cfg, setCfg] = useState<TableConfig>(() => JSON.parse(JSON.stringify(block.config)) as TableConfig);
  const [showDesign, setShowDesign] = useState(false);
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => sampleCells(cfg), [cfg]);

  const patch = (p: Partial<TableConfig>) => setCfg((c) => ({ ...c, ...p }));
  const setCols = (columns: TableColumn[]) => patch({ columns });
  const setCol = (i: number, p: Partial<TableColumn>) => setCols(cfg.columns.map((c, idx) => (idx === i ? { ...c, ...p } : c)));
  const setStyle = (p: Partial<TableStyle>) => patch({ style: { ...(cfg.style ?? {}), ...p } });

  const dataCols = cfg.columns.filter((c) => c.field_type !== 'calc' && c.field_type !== 'result');

  const addRow = () => patch({ rows: [...cfg.rows, { id: newId(), label: `תת מערכת ${cfg.rows.length + 1}` }] });
  const addColumn = () => setCols([...cfg.columns.slice(0, Math.max(0, cfg.columns.length - 1)), { id: newId(), label: 'עמודה חדשה', field_type: 'number' }, ...cfg.columns.slice(Math.max(0, cfg.columns.length - 1))]);

  const save = async () => {
    setBusy(true);
    try {
      await updateBlockConfig(block.id, cfg);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="עורך טבלת תתי־מערכות" maxWidth="max-w-5xl">
      <div className="space-y-5">
        {/* Title + toolbar */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="label">כותרת הטבלה</label>
            <input className="input" value={cfg.title} onChange={(e) => patch({ title: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary btn-sm gap-1.5" onClick={addRow}><Icon name="plus" size={15} /> הוסף תת־מערכת</button>
            <button className="btn-secondary btn-sm gap-1.5" onClick={addColumn}><Icon name="plus" size={15} /> הוסף עמודה</button>
            <button className={`btn-sm gap-1.5 ${showDesign ? 'btn-primary' : 'btn-outline'}`} onClick={() => setShowDesign((s) => !s)}><Icon name="settings" size={15} /> עיצוב טבלה</button>
          </div>
        </div>

        {/* Live preview */}
        <div>
          <div className="mb-1.5 eyebrow">תצוגה מקדימה</div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <SubsystemGrid config={cfg} cells={preview} editable={false} />
          </div>
        </div>

        {/* Design panel */}
        {showDesign && <DesignPanel style={cfg.style} onChange={setStyle} onReset={() => patch({ style: undefined })} onPreset={(s) => patch({ style: s })} />}

        {/* Sub-systems (rows) */}
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-ink-800">תתי־מערכות (שורות)</h3>
            <button className="btn-ghost btn-sm gap-1" onClick={addRow}><Icon name="plus" size={14} /> הוסף</button>
          </div>
          <div className="space-y-1.5">
            {cfg.rows.map((row, i) => (
              <div key={row.id} className="flex items-center gap-2">
                <span className="w-5 text-center text-[12px] text-ink-400">{i + 1}</span>
                <input className="input !min-h-0 flex-1 !py-1.5 text-[13.5px]" value={row.label} placeholder={`תת מערכת ${i + 1}`} onChange={(e) => patch({ rows: cfg.rows.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)) })} />
                <IconBtn name="up" title="מעלה" onClick={() => patch({ rows: reorder(cfg.rows, i, -1) })} />
                <IconBtn name="down" title="מטה" onClick={() => patch({ rows: reorder(cfg.rows, i, 1) })} />
                <IconBtn name="file" title="שכפל" onClick={() => patch({ rows: [...cfg.rows.slice(0, i + 1), { id: newId(), label: row.label + ' (עותק)' }, ...cfg.rows.slice(i + 1)] })} />
                <IconBtn name="trash" title="מחק" danger onClick={() => patch({ rows: cfg.rows.filter((_, idx) => idx !== i) })} />
              </div>
            ))}
          </div>
        </section>

        {/* Columns */}
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-ink-800">עמודות</h3>
            <button className="btn-ghost btn-sm gap-1" onClick={addColumn}><Icon name="plus" size={14} /> הוסף עמודה</button>
          </div>
          <div className="space-y-3">
            {cfg.columns.map((col, i) => (
              <ColumnRow
                key={col.id}
                col={col}
                index={i}
                dataCols={dataCols}
                onChange={(p) => setCol(i, p)}
                onUp={() => setCols(reorder(cfg.columns, i, -1))}
                onDown={() => setCols(reorder(cfg.columns, i, 1))}
                onDup={() => setCols([...cfg.columns.slice(0, i + 1), { ...col, id: newId(), label: col.label + ' (עותק)' }, ...cfg.columns.slice(i + 1)])}
                onDelete={() => setCols(cfg.columns.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
        </section>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <span className="text-[12px] text-ink-400">המבנה והעיצוב נשמרים כהגדרות; כל בד״ח שבוצע שומר Snapshot משלו.</span>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>ביטול</button>
            <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'שומר…' : 'שמור טבלה'}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function IconBtn({ name, title, onClick, danger }: { name: IconName; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`rounded-md border border-slate-200 p-1.5 ${danger ? 'text-fault-600 hover:bg-fault-50' : 'text-ink-500 hover:bg-slate-50'}`}>
      <Icon name={name} size={14} />
    </button>
  );
}

function ColumnRow({ col, index, dataCols, onChange, onUp, onDown, onDup, onDelete }: {
  col: TableColumn;
  index: number;
  dataCols: TableColumn[];
  onChange: (p: Partial<TableColumn>) => void;
  onUp: () => void; onDown: () => void; onDup: () => void; onDelete: () => void;
}) {
  const isCalc = col.field_type === 'calc';
  const numericFrom = dataCols.filter((c) => c.field_type === 'number');
  const timeFrom = dataCols.filter((c) => c.field_type === 'time' || c.field_type === 'datetime');
  const pickFrom = col.calc?.kind === 'duration' ? timeFrom : numericFrom;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-5 text-center text-[12px] text-ink-400">{index + 1}</span>
        <input className="input !min-h-0 min-w-[140px] flex-1 !py-1.5 text-[13.5px]" value={col.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="כותרת העמודה" />
        <select className="input !min-h-0 !w-auto !py-1.5 text-[13px]" value={col.field_type} onChange={(e) => {
          const ft = e.target.value as FieldType;
          onChange({ field_type: ft, calc: ft === 'calc' ? (col.calc ?? { kind: 'difference', from: numericFrom[0]?.id ?? '', to: numericFrom[1]?.id ?? '' }) : undefined });
        }}>
          {COL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {/* icon picker */}
        <select className="input !min-h-0 !w-auto !py-1.5 text-[13px]" value={col.icon ?? ''} onChange={(e) => onChange({ icon: e.target.value || undefined })} title="אייקון כותרת">
          {ICON_CHOICES.map((ic) => <option key={ic} value={ic}>{ic ? ic : 'ללא אייקון'}</option>)}
        </select>
        {col.icon && <span className="text-ink-500"><Icon name={col.icon as IconName} size={16} /></span>}
        <input type="number" className="input !min-h-0 !w-[72px] !py-1.5 text-[13px]" value={col.width ?? ''} placeholder="רוחב" title="רוחב בפיקסלים (רשות)" onChange={(e) => onChange({ width: e.target.value ? Number(e.target.value) : undefined })} />
        <IconBtn name="up" title="מעלה" onClick={onUp} />
        <IconBtn name="down" title="מטה" onClick={onDown} />
        <IconBtn name="file" title="שכפל" onClick={onDup} />
        <IconBtn name="trash" title="מחק" danger onClick={onDelete} />
      </div>

      {isCalc && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 text-[13px]">
          <span className="font-semibold text-ink-600">חישוב:</span>
          <select className="input !min-h-0 !w-auto !py-1.5 text-[13px]" value={col.calc?.kind ?? 'difference'} onChange={(e) => {
            const kind = e.target.value as 'difference' | 'duration';
            onChange({ calc: { kind, from: '', to: '' }, allowed_difference: kind === 'difference' ? (col.allowed_difference ?? 25) : undefined, min_minutes: kind === 'duration' ? (col.min_minutes ?? 180) : undefined });
          }}>
            <option value="difference">הפרש (סיום − התחלה)</option>
            <option value="duration">משך (זמן סיום − זמן התחלה)</option>
          </select>
          <span className="text-ink-500">מ־</span>
          <select className="input !min-h-0 !w-auto !py-1.5 text-[13px]" value={col.calc?.from ?? ''} onChange={(e) => onChange({ calc: { ...(col.calc ?? { kind: 'difference', to: '' }), from: e.target.value } as never })}>
            <option value="">בחר עמודה…</option>
            {pickFrom.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <span className="text-ink-500">עד</span>
          <select className="input !min-h-0 !w-auto !py-1.5 text-[13px]" value={col.calc?.to ?? ''} onChange={(e) => onChange({ calc: { ...(col.calc ?? { kind: 'difference', from: '' }), to: e.target.value } as never })}>
            <option value="">בחר עמודה…</option>
            {pickFrom.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {col.calc?.kind === 'difference' ? (
            <span className="flex items-center gap-1.5">
              <span className="text-ink-600">פער מותר ±</span>
              <input type="number" className="input !min-h-0 !w-[80px] !py-1.5 text-[13px]" value={col.allowed_difference ?? ''} onChange={(e) => onChange({ allowed_difference: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="text-ink-600">זמן מינימלי (דק׳)</span>
              <input type="number" className="input !min-h-0 !w-[90px] !py-1.5 text-[13px]" value={col.min_minutes ?? ''} onChange={(e) => onChange({ min_minutes: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <span className="flex gap-1">
                {MIN_PRESETS.map((m) => (
                  <button key={m} type="button" className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-ink-500 hover:bg-white" onClick={() => onChange({ min_minutes: m })}>{formatDuration(m)}</button>
                ))}
              </span>
            </span>
          )}
        </div>
      )}
      {col.field_type === 'select' && (
        <div className="mt-2 border-t border-slate-200 pt-2">
          <input className="input !min-h-0 !py-1.5 text-[13px]" value={(col.options ?? []).join(', ')} placeholder="ערכי בחירה, מופרדים בפסיק" onChange={(e) => onChange({ options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
        </div>
      )}
    </div>
  );
}

function DesignPanel({ style, onChange, onReset, onPreset }: { style?: TableStyle; onChange: (p: Partial<TableStyle>) => void; onReset: () => void; onPreset: (s?: TableStyle) => void }) {
  const s = style ?? {};
  const color = (label: string, key: keyof TableStyle, fallback: string) => (
    <label className="flex items-center justify-between gap-2 text-[13px]">
      <span className="text-ink-600">{label}</span>
      <input type="color" className="h-7 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5" value={(s[key] as string) || fallback} onChange={(e) => onChange({ [key]: e.target.value } as Partial<TableStyle>)} />
    </label>
  );
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-ink-800">🎨 עיצוב טבלה</h3>
        <button className="btn-ghost btn-sm gap-1.5" onClick={onReset}><Icon name="refresh" size={14} /> איפוס לברירת מחדל</button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" className="rounded-md border border-slate-200 px-3 py-1.5 text-[12.5px] font-semibold text-ink-600 hover:bg-slate-50" onClick={() => onPreset(p.style)}>{p.name}</button>
        ))}
      </div>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {color('רקע כותרות', 'head_bg', '#0e1f3a')}
        {color('צבע טקסט כותרות', 'head_text', '#ffffff')}
        {color('רקע שורות', 'row_bg', '#ffffff')}
        {color('צבע טקסט', 'text', '#16202f')}
        {color('צבע גבולות', 'border', '#d9e0ea')}
        {color('צבע "עבר"', 'pass_color', '#15803d')}
        {color('צבע "לא עבר"', 'fail_color', '#b91c1c')}
        <label className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-ink-600">עובי גבולות</span>
          <input type="range" min={1} max={3} step={1} value={s.border_width ?? 1} onChange={(e) => onChange({ border_width: Number(e.target.value) })} />
        </label>
        <label className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-ink-600">גודל כתב</span>
          <input type="range" min={12} max={18} step={1} value={s.font_size ?? 14} onChange={(e) => onChange({ font_size: Number(e.target.value) })} />
        </label>
        <label className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-ink-600">גובה שורות</span>
          <input type="range" min={36} max={64} step={2} value={s.row_height ?? 44} onChange={(e) => onChange({ row_height: Number(e.target.value) })} />
        </label>
        <label className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-ink-600">כותרות מודגשות</span>
          <input type="checkbox" className="h-5 w-5" checked={s.bold_head !== false} onChange={(e) => onChange({ bold_head: e.target.checked })} />
        </label>
        <label className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-ink-600">יישור</span>
          <select className="input !min-h-0 !w-auto !py-1 text-[13px]" value={s.align ?? 'center'} onChange={(e) => onChange({ align: e.target.value as TableStyle['align'] })}>
            <option value="right">ימין</option>
            <option value="center">מרכז</option>
            <option value="left">שמאל</option>
          </select>
        </label>
      </div>
    </section>
  );
}
