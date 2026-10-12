import { useEffect, useState } from 'react';
import { newId } from '@/services/ids';
import { updateBlockConfig } from '@/services/blocks';
import { getMeasureDurationDefault, setMeasureDurationDefault } from '@/services/settings';
import { formatDuration } from '@/services/measurements';
import { Modal } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type {
  DurationRule,
  FieldType,
  MeasurementRule,
  TableColumn,
  TableConfig,
  TableRow,
  TemplateBlock,
} from '@/types';

const FIELD_LABELS: Record<FieldType, string> = {
  short_text: 'טקסט קצר',
  long_text: 'טקסט ארוך',
  number: 'מספר',
  decimal: 'מספר עשרוני',
  time: 'שעה',
  date: 'תאריך',
  datetime: 'תאריך ושעה',
  bool: 'כן / לא',
  select: 'בחירה מרשימה',
  multiselect: 'בחירה מרובה',
  percent: 'אחוז',
};
const NUMERIC: FieldType[] = ['number', 'decimal', 'percent'];
const HAS_UNIT: FieldType[] = ['number', 'decimal', 'percent'];
const HAS_OPTIONS: FieldType[] = ['select', 'multiselect'];

/** A common suggested-units list; the admin may also type a custom unit. */
const UNIT_SUGGESTIONS = ['V', 'A', '°C', 'RPM', 'bar', '%', 'שעות', 'דקות'];

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const n = [...arr];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

/**
 * Full table builder — the admin designs the table structure (rows, columns,
 * field types, units, select options, required) and the measurement rules
 * (±X gap). Nothing is hard-coded: every label and option is editable.
 */
export function TableBlockEditor({
  block,
  systemId,
  rankId,
  onClose,
  onSaved,
  notify,
}: {
  block: TemplateBlock;
  systemId: string | null;
  rankId: string | null;
  onClose: () => void;
  onSaved: () => void;
  notify: (m: string, k?: 'ok' | 'error' | 'info') => void;
}) {
  const initial = block.config as TableConfig;
  const [title, setTitle] = useState(initial.title ?? 'טבלת מדידה');
  const [description, setDescription] = useState(initial.description ?? '');
  const [required, setRequired] = useState(!!initial.required);
  const [columns, setColumns] = useState<TableColumn[]>(initial.columns ?? []);
  const [rows, setRows] = useState<TableRow[]>(initial.rows ?? []);
  const [rules, setRules] = useState<MeasurementRule[]>(initial.rules ?? []);
  // Duration rule (timer mode — Start/Stop device clock; admin sets only the minimum)
  const [durOn, setDurOn] = useState(!!initial.duration);
  const [durUseDefault, setDurUseDefault] = useState(initial.duration?.use_default ?? true);
  const [durMinutes, setDurMinutes] = useState<number>(initial.duration?.min_minutes ?? 360);
  const [sysDefault, setSysDefault] = useState<number | null>(null);
  const [showExec, setShowExec] = useState(initial.show_in_execution !== false);
  const [showPdf, setShowPdf] = useState(initial.show_in_pdf !== false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMeasureDurationDefault(systemId, rankId).then(setSysDefault).catch(() => setSysDefault(null));
  }, [systemId, rankId]);

  // ---- columns ----
  const addColumn = () => setColumns((c) => [...c, { id: newId(), label: `עמודה ${c.length + 1}`, field_type: 'short_text', required: false }]);
  const updateColumn = (id: string, patch: Partial<TableColumn>) => setColumns((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeColumn = (id: string) => {
    setColumns((c) => (c.length <= 1 ? c : c.filter((x) => x.id !== id)));
    setRules((rs) => rs.filter((r) => r.initial.col_id !== id && r.final.col_id !== id));
  };
  const moveColumn = (i: number, dir: -1 | 1) => setColumns((c) => move(c, i, dir));

  // ---- rows ----
  const addRow = () => setRows((r) => [...r, { id: newId(), label: `שורה ${r.length + 1}` }]);
  const updateRow = (id: string, label: string) => setRows((r) => r.map((x) => (x.id === id ? { ...x, label } : x)));
  const removeRow = (id: string) => {
    setRows((r) => (r.length <= 1 ? r : r.filter((x) => x.id !== id)));
    setRules((rs) => rs.filter((r) => r.initial.row_id !== id && r.final.row_id !== id));
  };
  const duplicateRow = (id: string) => setRows((r) => {
    const idx = r.findIndex((x) => x.id === id);
    if (idx < 0) return r;
    const copy = { id: newId(), label: `${r[idx].label} (העתק)` };
    return [...r.slice(0, idx + 1), copy, ...r.slice(idx + 1)];
  });
  const moveRow = (i: number, dir: -1 | 1) => setRows((r) => move(r, i, dir));

  // ---- measurement rules (±X) ----
  const numericCells = rows.flatMap((row) =>
    columns.filter((c) => NUMERIC.includes(c.field_type)).map((col) => ({
      key: `${row.id}|${col.id}`,
      row_id: row.id,
      col_id: col.id,
      label: `${row.label} · ${col.label}`,
    }))
  );
  const addRule = () => {
    if (numericCells.length < 2) {
      notify('נדרשות לפחות שתי תאים מספריים כדי להגדיר חוק פער', 'error');
      return;
    }
    setRules((rs) => [
      ...rs,
      {
        id: newId(),
        type: 'delta',
        initial: { row_id: numericCells[0].row_id, col_id: numericCells[0].col_id },
        final: { row_id: numericCells[1].row_id, col_id: numericCells[1].col_id },
        allowed_difference: 25,
        fail_on_exceed: true,
      },
    ]);
  };
  const updateRule = (id: string, patch: Partial<MeasurementRule>) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRule = (id: string) => setRules((rs) => rs.filter((r) => r.id !== id));
  const setRuleCell = (id: string, side: 'initial' | 'final', key: string) => {
    const [row_id, col_id] = key.split('|');
    updateRule(id, { [side]: { row_id, col_id } } as Partial<MeasurementRule>);
  };

  const effectiveMin = durUseDefault ? sysDefault ?? 0 : durMinutes;

  const save = async () => {
    if (!title.trim()) { notify('יש להזין שם טבלה', 'error'); return; }
    if (columns.length === 0 || rows.length === 0) { notify('הטבלה חייבת לפחות עמודה ושורה אחת', 'error'); return; }
    for (const c of columns) {
      if (!c.label.trim()) { notify('יש עמודה ללא שם', 'error'); return; }
      if (HAS_OPTIONS.includes(c.field_type) && !(c.options ?? []).filter(Boolean).length) {
        notify(`לעמודה "${c.label}" מסוג בחירה חסרות אפשרויות`, 'error'); return;
      }
    }
    for (const r of rules) {
      if (!(r.allowed_difference >= 0) || !Number.isFinite(r.allowed_difference)) {
        notify('פער מותר חייב להיות מספר אי-שלילי', 'error'); return;
      }
    }
    let duration: DurationRule | undefined;
    if (durOn) {
      if (!durUseDefault && !(durMinutes > 0)) { notify('משך מינימלי חייב להיות גדול מאפס', 'error'); return; }
      if (durUseDefault && !(Number(sysDefault) > 0)) { notify('יש להגדיר ברירת מחדל של משך (דקות) למערכת והדרג', 'error'); return; }
      duration = {
        mode: 'timer',
        use_default: durUseDefault,
        min_minutes: durUseDefault ? undefined : durMinutes,
      };
    }
    const config: TableConfig = {
      title: title.trim(),
      description: description.trim(),
      duration,
      required,
      columns: columns.map((c) => ({
        ...c,
        label: c.label.trim(),
        options: HAS_OPTIONS.includes(c.field_type) ? (c.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
        unit: HAS_UNIT.includes(c.field_type) ? (c.unit ?? '').trim() : undefined,
      })),
      rows: rows.map((r) => ({ ...r, label: r.label.trim() })),
      rules,
      show_in_execution: showExec,
      show_in_pdf: showPdf,
    };
    setBusy(true);
    try {
      // When using the system+rank default, persist the admin-edited default too.
      if (durOn && durUseDefault && sysDefault !== null) {
        await setMeasureDurationDefault(systemId, rankId, sysDefault);
      }
      await updateBlockConfig(block.id, config);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      draggable
      onClose={onClose}
      title="טבלת מדידה"
      maxWidth="max-w-3xl"
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={save}>שמור</button>
          <button type="button" className="btn-ghost" onClick={onClose}>ביטול</button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* פרטי הטבלה */}
        <SectionBox title="פרטי הטבלה">
          <div>
            <label className="label">שם הטבלה</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">שורת הוראה / הסבר (טקסט חופשי)</label>
            <textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="למשל: יש לבצע מדידה רצופה במשך 6 שעות לפחות." />
            <p className="mt-1 text-xs text-ink-400">שינוי הניסוח אינו משנה את משך המדידה המינימלי או את חוקי החישוב — אלה מוגדרים בנפרד למטה.</p>
          </div>
        </SectionBox>

        {/* הגדרות זמן */}
        <SectionBox title="הגדרות זמן — משך מדידה מינימלי">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={durOn} onChange={(e) => setDurOn(e.target.checked)} />
            <span className="text-sm font-medium text-ink-700">אכוף משך מדידה מינימלי</span>
          </label>
          {durOn && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <p className="text-[12.5px] text-ink-500">
                המבצע ילחץ "התחל דגימה" ו"סיום דגימה" בזמן הבדיקה; התאריך והשעה נלקחים משעון המכשיר.
                המערכת מחשבת את המשך בפועל ואוכפת את המינימום שתגדיר כאן — אין צורך להגדיר שדות.
              </p>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="h-5 w-5" checked={durUseDefault} onChange={(e) => setDurUseDefault(e.target.checked)} />
                <span className="text-sm text-ink-700">השתמש בברירת המחדל של המערכת והדרג</span>
              </label>
              {durUseDefault ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink-600">ברירת מחדל למערכת+דרג (דקות):</span>
                  <input
                    type="number"
                    min={0}
                    className="input !min-h-0 w-28 !py-1.5"
                    value={sysDefault ?? ''}
                    placeholder="לא הוגדר"
                    onChange={(e) => setSysDefault(e.target.value === '' ? null : Number(e.target.value))}
                  />
                  <span className="text-xs text-ink-400">({formatDuration(sysDefault)})</span>
                </div>
              ) : (
                <DurationInput minutes={durMinutes} onChange={setDurMinutes} />
              )}
              <div className="text-xs text-ink-500">משך מינימלי מיושם: <b>{formatDuration(effectiveMin || null)}</b></div>
            </div>
          )}
        </SectionBox>

        {/* מבנה הטבלה */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-ink-700">עמודות</span>
            <button type="button" className="btn-secondary btn-sm gap-1.5" onClick={addColumn}><Icon name="plus" size={14} /> הוסף עמודה</button>
          </div>
          <div className="space-y-2">
            {columns.map((c, i) => (
              <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <input className="input !min-h-0 flex-1 !py-1.5" value={c.label} placeholder="שם עמודה" onChange={(e) => updateColumn(c.id, { label: e.target.value })} />
                  <select className="input !min-h-0 w-36 !py-1.5" value={c.field_type} onChange={(e) => updateColumn(c.id, { field_type: e.target.value as FieldType })}>
                    {(Object.keys(FIELD_LABELS) as FieldType[]).map((ft) => <option key={ft} value={ft}>{FIELD_LABELS[ft]}</option>)}
                  </select>
                  {HAS_UNIT.includes(c.field_type) && (
                    <input className="input !min-h-0 w-24 !py-1.5" list="unit-suggestions" value={c.unit ?? ''} placeholder="יחידה" onChange={(e) => updateColumn(c.id, { unit: e.target.value })} />
                  )}
                  <label className="flex items-center gap-1 text-xs text-ink-600"><input type="checkbox" className="h-4 w-4" checked={!!c.required} onChange={(e) => updateColumn(c.id, { required: e.target.checked })} /> חובה</label>
                  <button type="button" className="btn-ghost !min-h-0 !p-1.5" onClick={() => moveColumn(i, -1)} disabled={i === 0}><Icon name="up" size={14} /></button>
                  <button type="button" className="btn-ghost !min-h-0 !p-1.5" onClick={() => moveColumn(i, 1)} disabled={i === columns.length - 1}><Icon name="down" size={14} /></button>
                  <button type="button" className="btn-ghost !min-h-0 !p-1.5 text-fault-600" onClick={() => removeColumn(c.id)} disabled={columns.length <= 1}><Icon name="trash" size={14} /></button>
                </div>
                {HAS_OPTIONS.includes(c.field_type) && (
                  <OptionsEditor options={c.options ?? []} onChange={(opts) => updateColumn(c.id, { options: opts })} />
                )}
              </div>
            ))}
          </div>
          <datalist id="unit-suggestions">{UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}</datalist>
        </div>

        {/* Rows */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-ink-700">שורות</span>
            <button type="button" className="btn-secondary btn-sm gap-1.5" onClick={addRow}><Icon name="plus" size={14} /> הוסף שורה</button>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2">
                <input className="input !min-h-0 flex-1 !py-1.5" value={r.label} placeholder="כותרת שורה" onChange={(e) => updateRow(r.id, e.target.value)} />
                <button type="button" className="btn-ghost !min-h-0 !p-1.5" onClick={() => moveRow(i, -1)} disabled={i === 0}><Icon name="up" size={14} /></button>
                <button type="button" className="btn-ghost !min-h-0 !p-1.5" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1}><Icon name="down" size={14} /></button>
                <button type="button" className="btn-ghost !min-h-0 !p-1.5" onClick={() => duplicateRow(r.id)} title="שכפל שורה"><Icon name="layers" size={14} /></button>
                <button type="button" className="btn-ghost !min-h-0 !p-1.5 text-fault-600" onClick={() => removeRow(r.id)} disabled={rows.length <= 1}><Icon name="trash" size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* הגדרות פער ותצוגה */}
        <SectionBox title="הגדרות פער (±X) ותצוגה">
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-ink-700">בדיקת פער בין ערכים (±X)</span>
                  <button type="button" className="btn-secondary btn-sm gap-1.5" onClick={addRule}><Icon name="plus" size={14} /> הוסף חוק</button>
                </div>
                {rules.length === 0 && <p className="text-[13px] text-ink-400">אין חוקי מדידה. ניתן להגדיר בדיקת פער בין שני תאים מספריים.</p>}
                <div className="space-y-2">
                  {rules.map((r) => (
                    <div key={r.id} className="rounded-lg border border-pending-200 bg-pending-50/40 p-2.5">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-xs text-ink-600">שדה התחלתי
                          <select className="input !min-h-0 !py-1.5" value={`${r.initial.row_id}|${r.initial.col_id}`} onChange={(e) => setRuleCell(r.id, 'initial', e.target.value)}>
                            {numericCells.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-ink-600">שדה סופי
                          <select className="input !min-h-0 !py-1.5" value={`${r.final.row_id}|${r.final.col_id}`} onChange={(e) => setRuleCell(r.id, 'final', e.target.value)}>
                            {numericCells.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-ink-600">פער מותר ±
                          <input type="number" step="any" className="input !min-h-0 w-24 !py-1.5" value={r.allowed_difference} onChange={(e) => updateRule(r.id, { allowed_difference: Number(e.target.value) })} />
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-ink-600">
                          <input type="checkbox" className="h-4 w-4" checked={r.fail_on_exceed !== false} onChange={(e) => updateRule(r.id, { fail_on_exceed: e.target.checked })} />
                          חריגה גורמת לכישלון הבדיקה
                        </label>
                        <button type="button" className="btn-ghost !min-h-0 !p-1.5 text-fault-600 mr-auto" onClick={() => removeRule(r.id)}><Icon name="trash" size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-3">
                <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={required} onChange={(e) => setRequired(e.target.checked)} /><span className="text-sm text-ink-600">מילוי הטבלה חובה</span></label>
                <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={showExec} onChange={(e) => setShowExec(e.target.checked)} /><span className="text-sm text-ink-600">הצג בזמן ביצוע</span></label>
                <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={showPdf} onChange={(e) => setShowPdf(e.target.checked)} /><span className="text-sm text-ink-600">הצג ב-PDF</span></label>
              </div>
            </div>
        </SectionBox>
      </div>
    </Modal>
  );
}

/** A labeled section wrapper for the table editor. */
function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2.5 text-sm font-bold text-brand-800">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** Minimum-duration input as hours + minutes (stored as total minutes). */
function DurationInput({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const h = Math.floor((minutes || 0) / 60);
  const m = (minutes || 0) % 60;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
      <span>משך מדידה מינימלי נדרש:</span>
      <input type="number" min={0} className="input !min-h-0 w-20 !py-1.5 nums" value={h} onChange={(e) => onChange(Math.max(0, Number(e.target.value)) * 60 + m)} />
      <span>שעות</span>
      <input type="number" min={0} max={59} className="input !min-h-0 w-20 !py-1.5 nums" value={m} onChange={(e) => onChange(h * 60 + Math.min(59, Math.max(0, Number(e.target.value))))} />
      <span>דקות</span>
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  const list = options.length ? options : [''];
  const set = (i: number, v: string) => onChange(list.map((x, idx) => (idx === i ? v : x)));
  const add = () => onChange([...list, '']);
  const removeI = (i: number) => onChange(list.length <= 1 ? [''] : list.filter((_, idx) => idx !== i));
  return (
    <div className="mt-2 rounded-md bg-white p-2">
      <div className="mb-1 text-xs font-semibold text-ink-500">אפשרויות הבחירה</div>
      <div className="space-y-1.5">
        {list.map((o, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input className="input !min-h-0 flex-1 !py-1" value={o} placeholder={`אפשרות ${i + 1}`} onChange={(e) => set(i, e.target.value)} />
            <button type="button" className="btn-ghost !min-h-0 !p-1 text-fault-600" onClick={() => removeI(i)}><Icon name="trash" size={13} /></button>
          </div>
        ))}
        <button type="button" className="btn-ghost btn-sm gap-1" onClick={add}><Icon name="plus" size={13} /> הוסף אפשרות</button>
      </div>
    </div>
  );
}
