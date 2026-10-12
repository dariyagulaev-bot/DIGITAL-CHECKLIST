import { MeasurementTable } from './MeasurementTable';
import { Icon } from './Icon';
import type {
  CompletedBlock,
  EquipmentConfig,
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
    case 'divider':
      return <hr className="my-1 border-slate-200" />;
    default:
      return null;
  }
}
