import { useRef, useState } from 'react';
import { Icon } from './Icon';
import type { ExamMarker } from '@/types';

/** A numbered dot positioned by RELATIVE coords (0..1), so it stays put on any
 * screen size. */
function Dot({ n, x, y, tone = 'brand', onPointerDown, title }: { n: number; x: number; y: number; tone?: 'brand' | 'ok' | 'fault' | 'muted'; onPointerDown?: (e: React.PointerEvent) => void; title?: string }) {
  const bg = tone === 'ok' ? 'bg-ok-500' : tone === 'fault' ? 'bg-fault-500' : tone === 'muted' ? 'bg-slate-400' : 'bg-brand-600';
  return (
    <span
      onPointerDown={onPointerDown}
      title={title}
      className={`absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer select-none items-center justify-center rounded-full border-2 border-white text-[12px] font-bold text-white shadow ${bg} touch-none`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      {n}
    </span>
  );
}

// ===== Admin: mark + name components on an image ===========================

export function ImageMarkerEditor({ image, markers, onChange }: { image: string; markers: ExamMarker[]; onChange: (m: ExamMarker[]) => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const dragId = useRef<string | null>(null);
  const moved = useRef(false);

  const relFromEvent = (e: { clientX: number; clientY: number }) => {
    const r = imgRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  const addMarker = (e: React.PointerEvent) => {
    if (dragId.current) return;
    const { x, y } = relFromEvent(e);
    onChange([...markers, { id: crypto.randomUUID(), x, y, component_name: '' }]);
  };

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    dragId.current = id; moved.current = false;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragId.current) return;
    moved.current = true;
    const { x, y } = relFromEvent(e);
    onChange(markers.map((m) => (m.id === dragId.current ? { ...m, x, y } : m)));
  };
  const endDrag = () => { dragId.current = null; };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12.5px] text-ink-500">
        <Icon name="image" size={15} /> לחצו על התמונה כדי לסמן רכיב · גררו סימון כדי להזיז
        <div className="ms-auto flex items-center gap-1">
          <button type="button" className="btn-ghost !min-h-0 !p-1.5" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} title="הקטן"><Icon name="search" size={14} />−</button>
          <span className="nums w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn-ghost !min-h-0 !p-1.5" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} title="הגדל"><Icon name="search" size={14} />+</button>
        </div>
      </div>
      <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-200 bg-slate-50">
        <div className="relative inline-block" style={{ width: `${zoom * 100}%` }} onPointerDown={addMarker} onPointerMove={onMove} onPointerUp={endDrag}>
          <img ref={imgRef} src={image} alt="ציוד" className="block w-full select-none" draggable={false} />
          {markers.map((m, i) => (
            <Dot key={m.id} n={i + 1} x={m.x} y={m.y} onPointerDown={(e) => startDrag(e, m.id)} title={m.component_name || `רכיב ${i + 1}`} />
          ))}
        </div>
      </div>
      {/* Marker names */}
      <div className="space-y-1.5">
        {markers.length === 0 && <p className="text-[13px] text-ink-400">אין רכיבים מסומנים. לחצו על התמונה כדי להוסיף.</p>}
        {markers.map((m, i) => (
          <div key={m.id} className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">{i + 1}</span>
            <input className="input !min-h-0 flex-1 !py-1.5" value={m.component_name} placeholder={`שם הרכיב ${i + 1}`} onChange={(e) => onChange(markers.map((x) => (x.id === m.id ? { ...x, component_name: e.target.value } : x)))} />
            <button type="button" className="btn-ghost !min-h-0 !p-1.5 text-fault-600" onClick={() => onChange(markers.filter((x) => x.id !== m.id))}><Icon name="trash" size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Examinee / preview: match names to numbered points ==================

export function ImageMatchTaker({
  image, markers, pool, value, onChange, editable = true, reveal,
}: {
  image: string;
  markers: ExamMarker[]; // coords used for placement; names are NOT shown to the examinee
  pool: string[]; // component names to choose from
  value: Record<string, string>; // markerId → chosen name
  onChange?: (v: Record<string, string>) => void;
  editable?: boolean;
  reveal?: Record<string, boolean>; // markerId → correct? (grading view)
}) {
  // relative coords come from the question markers; this component is given only
  // ids + we read coords from the parent via markersWithCoords.
  const [selMarker, setSelMarker] = useState<string | null>(null);
  const [selName, setSelName] = useState<string | null>(null);

  const assign = (markerId: string, name: string) => {
    if (!editable || !onChange) return;
    const next = { ...value };
    // a name maps to one marker — clear it elsewhere.
    for (const k of Object.keys(next)) if (next[k] === name) delete next[k];
    next[markerId] = name;
    onChange(next);
    setSelMarker(null); setSelName(null);
  };
  const clear = (markerId: string) => { if (!editable || !onChange) return; const next = { ...value }; delete next[markerId]; onChange(next); };

  const tapMarker = (id: string) => {
    if (!editable) return;
    if (selName) return assign(id, selName);
    if (value[id]) return clear(id);
    setSelMarker((cur) => (cur === id ? null : id));
  };
  const tapName = (name: string) => {
    if (!editable) return;
    if (selMarker) return assign(selMarker, name);
    setSelName((cur) => (cur === name ? null : name));
  };

  const usedNames = new Set(Object.values(value));
  return (
    <ImageMatchLayout
      image={image}
      markers={markers}
      value={value}
      reveal={reveal}
      selMarker={selMarker}
      onMarker={tapMarker}
    >
      <div className="mt-3 flex flex-wrap gap-2">
        {pool.map((name) => {
          const used = usedNames.has(name);
          const selected = selName === name;
          return (
            <button
              key={name}
              type="button"
              disabled={!editable}
              onClick={() => tapName(name)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                selected ? 'border-brand-500 bg-brand-600 text-white' : used ? 'border-slate-200 bg-slate-100 text-ink-400' : 'border-slate-300 bg-white text-ink-700 hover:border-brand-300'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      {editable && (
        <p className="mt-2 text-[12px] text-ink-400">
          {selMarker ? 'בחרו שם רכיב להתאמה לנקודה המסומנת' : selName ? 'לחצו על הנקודה בתמונה שמתאימה לשם שבחרתם' : 'לחצו על נקודה בתמונה או על שם רכיב כדי להתחיל התאמה'}
        </p>
      )}
    </ImageMatchLayout>
  );
}

/** Shared image + numbered-dots layout (coords read from the marker objects). */
function ImageMatchLayout({
  image, markers, value, reveal, selMarker, onMarker, children,
}: {
  image: string;
  markers: (ExamMarker & { id: string })[];
  value: Record<string, string>;
  reveal?: Record<string, boolean>;
  selMarker?: string | null;
  onMarker?: (id: string) => void;
  children?: React.ReactNode;
}) {
  const [zoom, setZoom] = useState(1);
  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-1 text-[12px] text-ink-400">
        <button type="button" className="btn-ghost !min-h-0 !p-1.5" onClick={() => setZoom((z) => Math.max(1, z - 0.5))}><Icon name="search" size={14} />−</button>
        <span className="nums w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button type="button" className="btn-ghost !min-h-0 !p-1.5" onClick={() => setZoom((z) => Math.min(4, z + 0.5))}><Icon name="search" size={14} />+</button>
      </div>
      <div className="max-h-[560px] overflow-auto rounded-lg border border-slate-200 bg-slate-50">
        <div className="relative inline-block" style={{ width: `${zoom * 100}%` }}>
          <img src={image} alt="ציוד" className="block w-full select-none" draggable={false} />
          {markers.map((m, i) => {
            const assigned = value[m.id];
            const tone = reveal ? (reveal[m.id] ? 'ok' : 'fault') : selMarker === m.id ? 'brand' : assigned ? 'ok' : 'muted';
            return (
              <span key={m.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}>
                <span onPointerDown={(e) => { e.preventDefault(); onMarker?.(m.id); }}
                  className={`flex h-7 w-7 cursor-pointer select-none items-center justify-center rounded-full border-2 border-white text-[12px] font-bold text-white shadow touch-none ${
                    tone === 'ok' ? 'bg-ok-500' : tone === 'fault' ? 'bg-fault-500' : tone === 'brand' ? 'bg-brand-600 ring-2 ring-brand-300' : 'bg-slate-400'
                  }`}>{i + 1}</span>
                {assigned && (
                  <span className="absolute right-1/2 top-8 z-10 translate-x-1/2 whitespace-nowrap rounded bg-ink-900/85 px-1.5 py-0.5 text-[11px] font-medium text-white">{assigned}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
