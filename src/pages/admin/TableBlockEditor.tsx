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
  TemplateBlock,
} from '@/types';

/**
 * Simplified measurement-table builder. The admin defines a flat list of
 * measurement FIELDS (name / type / unit / required) — no rows, columns, IDs or
 * formulas exposed. Internally each field is a column on one hidden row, so the
 * whole evaluation / snapshot / export engine is reused unchanged. Advanced
 * checks (±X gap) live in a collapsible section so the main screen stays clean.
 */

const FIELD_LABELS: Record<FieldType, string> = {
  number: 'מספר',
  decimal: 'מספר עשרוני',
  percent: 'אחוז',
  short_text: 'טקסט קצר',
  long_text: 'טקסט ארוך',
  bool: 'כן / לא',
  select: 'בחירה מרשימה',
  multiselect: 'בחירה מרובה',
  time: 'שעה',
  date: 'תאריך',
  datetime: 'תאריך ושעה',
};
/** Order shown in the type dropdown (most common first). */
const FIELD_ORDER: FieldType[] = ['number', 'decimal', 'percent', 'short_text', 'long_text', 'bool', 'select', 'multiselect', 'time', 'date'];
const NUMERIC: FieldType[] = ['number', 'decimal', 'percent'];
const HAS_UNIT: FieldType[] = ['number', 'decimal', 'percent'];
const HAS_OPTIONS: FieldType[] = ['select', 'multiselect'];

/** Common units; the admin may also type a custom one ("אחר…"). Not hard-locked. */
const UNIT_SUGGESTIONS = ['V', 'A', 'mA', 'W', 'kW', '°C', 'RPM', 'bar', 'Hz', '%', 'mm', 'cm', 'm', 'sec', 'min', 'h'];

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const n = [...arr];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

/**
 * Derive a flat field list + a single row id from any table config. A config
 * already in 'fields' layout (or with ≤1 row) uses its columns as fields; a
 * legacy row×column grid is flattened (one field per cell) and its rules are
 * remapped onto the new single row — so opening an old table in this editor and
 * saving migrates it cleanly without losing the ±X checks.
 */
function toFields(cfg: TableConfig): { rowId: string; fields: TableColumn[]; rules: MeasurementRule[] } {
  const singleRow = (cfg.rows?.length ?? 0) <= 1;
  if (cfg.layout === 'fields' || singleRow) {
    return { rowId: cfg.rows?.[0]?.id ?? newId(), fields: cfg.columns ?? [], rules: cfg.rules ?? [] };
  }
  const rowId = newId();
  const fields: TableColumn[] = [];
  const remap = new Map<string, string>();
  const multiCol = (cfg.columns?.length ?? 0) > 1;
  for (const row of cfg.rows) {
    for (const col of cfg.columns) {
      const id = newId();
      remap.set(`${row.id}|${col.id}`, id);
      fields.push({ id, label: multiCol ? `${row.label} · ${col.label}` : row.label, field_type: col.field_type, unit: col.unit, required: col.required, options: col.options });
    }
  }
  const rules = (cfg.rules ?? []).map((rule) => ({
    ...rule,
    initial: { row_id: rowId, col_id: remap.get(`${rule.initial.row_id}|${rule.initial.col_id}`) ?? rule.initial.col_id },
    final: { row_id: rowId, col_id: remap.get(`${rule.final.row_id}|${rule.final.col_id}`) ?? rule.final.col_id },
  }));
  return { rowId, fields, rules };
}

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
  const migrated = toFields(initial);
  const [rowId] = useState(migrated.rowId);
  const [title, setTitle] = useState(initial.title ?? 'טבלת מדידה');
  const [description, setDescription] = useState(initial.description ?? '');
  const [fields, setFields] = useState<TableColumn[]>(
    migrated.fields.length ? migrated.fields : [{ id: newId(), label: 'מספר התחלתי', field_type: 'number', required: false, unit: '' }]
  );
  const [rules, setRules] = useState<MeasurementRule[]>(migrated.rules);
  // Minimum duration (timer mode — admin only sets the minimum, in hours)
  const [durOn, setDurOn] = useState(!!initial.duration);
  const [durUseDefault, setDurUseDefault] = useState(initial.duration?.use_default ?? true);
  const [durMinutes, setDurMinutes] = useState<number>(initial.duration?.min_minutes ?? 360);
  const [sysDefault, setSysDefault] = useState<number | null>(null);
  const [required, setRequired] = useState(!!initial.required);
  const [showExec, setShowExec] = useState(initial.show_in_execution !== false);
  const [showPdf, setShowPdf] = useState(initial.show_in_pdf !== false);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMeasureDurationDefault(systemId, rankId).then(setSysDefault).catch(() => setSysDefault(null));
  }, [systemId, rankId]);

  // ---- fields ----
  const addField = () =>
    setFields((f) => [...f, { id: newId(), label: `שדה ${f.length + 1}`, field_type: 'number', required: false, unit: '' }]);
  const updateField = (id: string, patch: Partial<TableColumn>) => setFields((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeField = (id: string) => {
    setFields((f) => (f.length <= 1 ? f : f.filter((x) => x.id !== id)));
    setRules((rs) => rs.filter((r) => r.initial.col_id !== id && r.final.col_id !== id));
  };
  const duplicateField = (id: string) =>
    setFields((f) => {
      const idx = f.findIndex((x) => x.id === id);
      if (idx < 0) return f;
      const copy: TableColumn = { ...f[idx], id: newId(), label: `${f[idx].label} (העתק)` };
      return [...f.slice(0, idx + 1), copy, ...f.slice(idx + 1)];
    });
  const moveField = (i: number, dir: -1 | 1) => setFields((f) => move(f, i, dir));

  // ---- ±X rules (advanced) ----
  const numericFields = fields.filter((f) => NUMERIC.includes(f.field_type)).map((f) => ({ key: f.id, label: f.label }));
  const addRule = () => {
    if (numericFields.length < 2) {
      notify('כדי להגדיר בדיקת פער צריך לפחות שני שדות מספריים', 'error');
      return;
    }
    setRules((rs) => [
      ...rs,
      { id: newId(), type: 'delta', initial: { row_id: rowId, col_id: numericFields[0].key }, final: { row_id: rowId, col_id: numericFields[1].key }, allowed_difference: 25, fail_on_exceed: true },
    ]);
  };
  const updateRule = (id: string, patch: Partial<MeasurementRule>) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRule = (id: string) => setRules((rs) => rs.filter((r) => r.id !== id));
  const setRuleField = (id: string, side: 'initial' | 'final', fieldId: string) =>
    updateRule(id, { [side]: { row_id: rowId, col_id: fieldId } } as Partial<MeasurementRule>);

  const effectiveMin = durUseDefault ? sysDefault ?? 0 : durMinutes;

  const save = async () => {
    if (!title.trim()) return notify('יש להזין שם טבלה', 'error');
    if (fields.length === 0) return notify('יש להוסיף לפחות שדה מדידה אחד', 'error');
    for (const f of fields) {
      if (!f.label.trim()) return notify('יש שדה ללא שם', 'error');
      if (HAS_OPTIONS.includes(f.field_type) && !(f.options ?? []).filter(Boolean).length) {
        return notify(`לשדה "${f.label}" מסוג בחירה חסרות אפשרויות`, 'error');
      }
    }
    for (const r of rules) {
      if (!(r.allowed_difference >= 0) || !Number.isFinite(r.allowed_difference)) return notify('פער מותר חייב להיות מספר אי-שלילי', 'error');
    }
    let duration: DurationRule | undefined;
    if (durOn) {
      if (!durUseDefault && !(durMinutes > 0)) return notify('משך מינימלי חייב להיות גדול מאפס', 'error');
      if (durUseDefault && !(Number(sysDefault) > 0)) return notify('יש להגדיר ברירת מחדל של משך (שעות) למערכת והדרג', 'error');
      duration = { mode: 'timer', use_default: durUseDefault, min_minutes: durUseDefault ? undefined : durMinutes };
    }
    const config: TableConfig = {
      title: title.trim(),
      description: description.trim(),
      layout: 'fields',
      duration,
      required,
      columns: fields.map((f) => ({
        ...f,
        label: f.label.trim(),
        options: HAS_OPTIONS.includes(f.field_type) ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
        unit: HAS_UNIT.includes(f.field_type) ? (f.unit ?? '').trim() : undefined,
      })),
      rows: [{ id: rowId, label: '' }],
      rules,
      show_in_execution: showExec,
      show_in_pdf: showPdf,
    };
    setBusy(true);
    try {
      if (durOn && durUseDefault && sysDefault !== null) await setMeasureDurationDefault(systemId, rankId, sysDefault);
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
            <label className="label">כותרת הטבלה</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">שורת הוראה / הסבר (לא חובה)</label>
            <textarea className="input min-h-[56px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="למשל: יש לבצע מדידה רצופה במשך 6 שעות לפחות." />
          </div>
          {/* משך מדידה מינימלי */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={durOn} onChange={(e) => setDurOn(e.target.checked)} />
              <span className="text-sm font-medium text-ink-700">משך מדידה מינימלי נדרש</span>
            </label>
            {durOn && (
              <div className="mt-3 space-y-3">
                <p className="text-[12.5px] text-ink-500">
                  המבצע ילחץ "התחל דגימה" ו"סיום דגימה" בזמן הבדיקה; הזמן נלקח משעון המכשיר והמערכת אוכפת את המינימום. אין צורך בשדות.
                </p>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-5 w-5" checked={durUseDefault} onChange={(e) => setDurUseDefault(e.target.checked)} />
                  <span className="text-sm text-ink-700">השתמש בברירת המחדל של המערכת והדרג</span>
                </label>
                {durUseDefault ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-ink-600">ברירת מחדל למערכת+דרג (שעות):</span>
                    <input type="number" min={0} step="0.5" className="input !min-h-0 w-28 !py-1.5 nums" value={sysDefault == null ? '' : sysDefault / 60} placeholder="לא הוגדר"
                      onChange={(e) => setSysDefault(e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value) * 60)))} />
                    <span className="text-xs text-ink-400">({formatDuration(sysDefault)})</span>
                  </div>
                ) : (
                  <HoursInput hours={durMinutes / 60} onChange={(h) => setDurMinutes(Math.max(0, Math.round(h * 60)))} />
                )}
                {!(effectiveMin > 0) && (
                  <div className="rounded-md border border-pending-200 bg-pending-50 px-3 py-2 text-[12.5px] text-pending-700">
                    שים לב: לא הוגדר משך מינימלי — כרגע הבדיקה לא תאכוף זמן. הזן מספר שעות כדי להפעיל את האכיפה.
                  </div>
                )}
                <div className="text-xs text-ink-500">משך מינימלי מיושם: <b>{formatDuration(effectiveMin || null)}</b></div>
              </div>
            )}
          </div>
        </SectionBox>

        {/* שדות המדידה */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-ink-700">שדות המדידה</span>
            <button type="button" className="btn-secondary btn-sm gap-1.5" onClick={addField}><Icon name="plus" size={14} /> הוסף שדה</button>
          </div>
          <div className="space-y-2.5">
            {fields.map((f, i) => (
              <div key={f.id} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-[150px] flex-1">
                    <label className="mb-0.5 block text-[11px] text-ink-500">שם השדה</label>
                    <input className="input !min-h-0 w-full !py-1.5" value={f.label} placeholder="למשל: מתח התחלתי" onChange={(e) => updateField(f.id, { label: e.target.value })} />
                  </div>
                  <div className="w-36">
                    <label className="mb-0.5 block text-[11px] text-ink-500">סוג</label>
                    <select className="input !min-h-0 w-full !py-1.5" value={f.field_type} onChange={(e) => updateField(f.id, { field_type: e.target.value as FieldType })}>
                      {FIELD_ORDER.map((ft) => <option key={ft} value={ft}>{FIELD_LABELS[ft]}</option>)}
                    </select>
                  </div>
                  {HAS_UNIT.includes(f.field_type) && (
                    <div className="w-40">
                      <label className="mb-0.5 block text-[11px] text-ink-500">יחידת מידה</label>
                      <UnitPicker value={f.unit ?? ''} onChange={(u) => updateField(f.id, { unit: u })} />
                    </div>
                  )}
                  <label className="mt-4 flex items-center gap-1.5 text-xs text-ink-600">
                    <input type="checkbox" className="h-4 w-4" checked={!!f.required} onChange={(e) => updateField(f.id, { required: e.target.checked })} /> שדה חובה
                  </label>
                  <div className="mt-4 flex items-center gap-0.5">
                    <button type="button" className="btn-ghost !min-h-0 !p-1.5" title="הזז למעלה" onClick={() => moveField(i, -1)} disabled={i === 0}><Icon name="up" size={14} /></button>
                    <button type="button" className="btn-ghost !min-h-0 !p-1.5" title="הזז למטה" onClick={() => moveField(i, 1)} disabled={i === fields.length - 1}><Icon name="down" size={14} /></button>
                    <button type="button" className="btn-ghost !min-h-0 !p-1.5" title="שכפל" onClick={() => duplicateField(f.id)}><Icon name="layers" size={14} /></button>
                    <button type="button" className="btn-ghost !min-h-0 !p-1.5 text-fault-600" title="מחק" onClick={() => removeField(f.id)} disabled={fields.length <= 1}><Icon name="trash" size={14} /></button>
                  </div>
                </div>
                {HAS_OPTIONS.includes(f.field_type) && (
                  <OptionsEditor options={f.options ?? []} onChange={(opts) => updateField(f.id, { options: opts })} />
                )}
                <FieldPreview field={f} />
              </div>
            ))}
          </div>
        </div>

        {/* הגדרות בדיקה מתקדמות */}
        <div className="rounded-xl border border-slate-200">
          <button type="button" className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-bold text-ink-700" onClick={() => setAdvanced((v) => !v)}>
            <span className="flex items-center gap-2"><Icon name={advanced ? 'down' : 'chevron-start'} size={14} /> הגדרות בדיקה מתקדמות</span>
            {rules.length > 0 && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{rules.length} חוקי פער</span>}
          </button>
          {advanced && (
            <div className="space-y-4 border-t border-slate-100 p-3">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink-700">בדיקת פער בין שדות (±X)</span>
                  <button type="button" className="btn-secondary btn-sm gap-1.5" onClick={addRule}><Icon name="plus" size={14} /> הוסף חוק</button>
                </div>
                {rules.length === 0 && <p className="text-[13px] text-ink-400">אין חוקי פער. ניתן לבדוק שהפער בין שני שדות מספריים אינו חורג מערך מותר.</p>}
                <div className="space-y-2">
                  {rules.map((r) => (
                    <div key={r.id} className="rounded-lg border border-pending-200 bg-pending-50/40 p-2.5">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-xs text-ink-600">שדה התחלתי
                          <select className="input !min-h-0 !py-1.5" value={r.initial.col_id} onChange={(e) => setRuleField(r.id, 'initial', e.target.value)}>
                            {numericFields.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-ink-600">שדה סופי
                          <select className="input !min-h-0 !py-1.5" value={r.final.col_id} onChange={(e) => setRuleField(r.id, 'final', e.target.value)}>
                            {numericFields.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-ink-600">פער מותר ±
                          <input type="number" step="any" className="input !min-h-0 w-24 !py-1.5" value={r.allowed_difference} onChange={(e) => updateRule(r.id, { allowed_difference: Number(e.target.value) })} />
                        </label>
                        <button type="button" className="btn-ghost !min-h-0 !p-1.5 text-fault-600 mr-auto" onClick={() => removeRule(r.id)}><Icon name="trash" size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-3">
                <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={required} onChange={(e) => setRequired(e.target.checked)} /><span className="text-sm text-ink-600">מילוי כל השדות חובה</span></label>
                <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={showExec} onChange={(e) => setShowExec(e.target.checked)} /><span className="text-sm text-ink-600">הצג בזמן ביצוע</span></label>
                <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={showPdf} onChange={(e) => setShowPdf(e.target.checked)} /><span className="text-sm text-ink-600">הצג ב-PDF</span></label>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** A labeled section wrapper. */
function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2.5 text-sm font-bold text-brand-800">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** Minimum-duration input in hours (half-hour steps; stored as total minutes). */
function HoursInput({ hours, onChange }: { hours: number; onChange: (h: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
      <span>משך מדידה מינימלי נדרש:</span>
      <input type="number" min={0} step="0.5" className="input !min-h-0 w-24 !py-1.5 nums" value={hours || ''} placeholder="0" onChange={(e) => onChange(Math.max(0, Number(e.target.value)))} />
      <span>שעות</span>
    </div>
  );
}

/** Unit-of-measure picker: common units + "אחר…" to type a custom one. */
function UnitPicker({ value, onChange }: { value: string; onChange: (u: string) => void }) {
  const known = value === '' || UNIT_SUGGESTIONS.includes(value);
  const [custom, setCustom] = useState(!known);
  return (
    <div className="flex items-center gap-1.5">
      <select
        className="input !min-h-0 w-full !py-1.5"
        value={custom ? '__custom__' : value}
        onChange={(e) => {
          if (e.target.value === '__custom__') { setCustom(true); }
          else { setCustom(false); onChange(e.target.value); }
        }}
      >
        <option value="">— ללא —</option>
        {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
        <option value="__custom__">אחר…</option>
      </select>
      {custom && (
        <input className="input !min-h-0 w-20 !py-1.5" value={value} placeholder="יחידה" onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/** Live preview of a field exactly as the performer will see it. */
function FieldPreview({ field }: { field: TableColumn }) {
  const placeholder =
    field.field_type === 'bool' ? 'כן / לא' : field.field_type === 'select' ? (field.options?.[0] || '—') : 'ערך';
  return (
    <div className="mt-2.5 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-2">
      <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-ink-400">תצוגה למבצע</div>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-semibold text-ink-700">{field.label || 'שם השדה'}{field.required && <span className="text-fault-500"> *</span>}</span>
        <span className="rounded border border-slate-200 bg-slate-50 px-4 py-0.5 text-ink-400 nums">{placeholder}</span>
        {HAS_UNIT.includes(field.field_type) && field.unit ? <span className="font-medium text-ink-600">{field.unit}</span> : null}
      </div>
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
