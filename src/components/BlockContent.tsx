import { MeasurementTable } from './MeasurementTable';
import { Icon } from './Icon';
import type {
  CompletedBlock,
  CustomField,
  EquipmentConfig,
  FieldsConfig,
  ImageConfig,
  SectionConfig,
  TableConfig,
  TextConfig,
} from '@/types';

/**
 * Renders a single NON-check execution block (section / text / image /
 * equipment / table / divider). Shared by the form runner (editable tables) and
 * the report view (read-only). `context` decides visibility: a block hidden
 * from execution or from the PDF is skipped in that context.
 */
export function BlockContent({
  block,
  context,
  editable = false,
  onTableChange,
  onTableTimer,
  onViewImage,
}: {
  block: CompletedBlock;
  context: 'execution' | 'report';
  editable?: boolean;
  onTableChange?: (blockId: string, cells: Record<string, string>) => void;
  onTableTimer?: (blockId: string, action: 'start' | 'stop' | 'reset') => void;
  onViewImage?: (src: string) => void;
}) {
  switch (block.type) {
    case 'section': {
      const c = block.config_snapshot as SectionConfig;
      return (
        <div className="border-r-4 border-r-brand-500 bg-brand-50/50 px-4 py-2.5">
          <h3 className="text-[16px] font-extrabold text-brand-800">{c.title}</h3>
        </div>
      );
    }
    case 'text': {
      const c = block.config_snapshot as TextConfig;
      if (!c.text?.trim()) return null;
      return (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 text-[14px] leading-relaxed text-ink-700">
          <Icon name="file" size={16} className="mt-0.5 shrink-0 text-ink-400" />
          <div className="whitespace-pre-wrap">{c.text}</div>
        </div>
      );
    }
    case 'image': {
      const c = block.config_snapshot as ImageConfig;
      const visible = context === 'report' ? c.show_in_pdf !== false : c.show_in_execution !== false;
      if (!visible || !c.image_data) return null;
      return (
        <figure className="rounded-xl border border-slate-200 bg-white p-3">
          {c.title && <figcaption className="mb-2 text-[14px] font-bold text-ink-800">{c.title}</figcaption>}
          <button type="button" onClick={() => onViewImage?.(c.image_data!)} className="block">
            <img src={c.image_data} alt={c.title ?? ''} className="max-h-72 w-full rounded-lg object-contain" />
          </button>
          {c.description && <figcaption className="mt-2 text-[13px] text-ink-500">{c.description}</figcaption>}
        </figure>
      );
    }
    case 'equipment': {
      const c = block.config_snapshot as EquipmentConfig;
      if (!c.items?.length) return null;
      return (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 text-[14px] font-bold text-ink-800">{c.title || 'ציוד נדרש'}</div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {c.items.map((it, i) => (
              <li key={i} className="flex items-center gap-2 text-[14px] text-ink-700">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                {it}
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case 'table': {
      const c = block.config_snapshot as TableConfig;
      const visible = context === 'report' ? c.show_in_pdf !== false : c.show_in_execution !== false;
      if (!visible) return null;
      return (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <MeasurementTable
            config={c}
            cells={block.data?.cells ?? {}}
            editable={editable}
            onChange={(next) => onTableChange?.(block.id, next)}
            startedAt={block.data?.started_at}
            endedAt={block.data?.ended_at}
            onTimer={(action) => onTableTimer?.(block.id, action)}
          />
        </section>
      );
    }
    case 'fields': {
      const c = block.config_snapshot as FieldsConfig;
      if (!c.fields?.length) return null;
      const cells = block.data?.cells ?? {};
      const setCell = (id: string, val: string) => onTableChange?.(block.id, { ...cells, [id]: val });
      return (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          {(c.title || c.description) && (
            <div className="mb-3">
              {c.title && <div className="text-[15px] font-bold text-ink-800">{c.title}</div>}
              {c.description && <div className="text-[13px] text-ink-500">{c.description}</div>}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {c.fields.map((f) =>
              context === 'report' ? (
                <div key={f.id} className="text-[14px]">
                  <span className="font-semibold text-ink-700">{f.label}: </span>
                  <span className="text-ink-900">{displayValue(f, cells[f.id])}</span>
                </div>
              ) : (
                <FieldInput key={f.id} field={f} value={cells[f.id] ?? ''} editable={editable} onChange={(v) => setCell(f.id, v)} />
              )
            )}
          </div>
        </section>
      );
    }
    case 'divider':
      return <hr className="my-1 border-slate-200" />;
    default:
      return null;
  }
}

function displayValue(f: CustomField, raw: string | undefined): string {
  if (f.field_type === 'bool') return raw === 'true' ? 'כן' : raw === 'false' ? 'לא' : '—';
  if (!raw) return '—';
  return f.unit ? `${raw} ${f.unit}` : raw;
}

/** A single editable custom-field input (used in the execution runner). */
function FieldInput({ field, value, editable, onChange }: { field: CustomField; value: string; editable: boolean; onChange: (v: string) => void }) {
  const label = (
    <label className="mb-1 block text-[13px] font-semibold text-ink-700">
      {field.label}
      {field.required && <span className="text-fault-600"> *</span>}
    </label>
  );
  const common = 'input !min-h-0 !py-2 text-[14px]';
  if (field.field_type === 'bool') {
    return (
      <div>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-[14px] text-ink-700">
          <input type="checkbox" className="h-5 w-5" checked={value === 'true'} disabled={!editable} onChange={(e) => onChange(e.target.checked ? 'true' : 'false')} />
          {field.label}{field.required && <span className="text-fault-600"> *</span>}
        </label>
      </div>
    );
  }
  if (field.field_type === 'select') {
    return (
      <div>
        {label}
        <select className={common} value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)}>
          <option value="">בחר…</option>
          {(field.options ?? []).filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  const type = field.field_type === 'number' || field.field_type === 'decimal' ? 'number' : field.field_type === 'date' ? 'date' : field.field_type === 'time' ? 'time' : 'text';
  if (field.field_type === 'long_text') {
    return <div>{label}<textarea className={common} rows={2} value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} /></div>;
  }
  return (
    <div>
      {label}
      <div className="flex items-center gap-2">
        <input type={type} inputMode={type === 'number' ? 'decimal' : undefined} className={common} value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} />
        {field.unit && <span className="text-[13px] text-ink-400">{field.unit}</span>}
      </div>
    </div>
  );
}
