import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPE } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/Layout';
import { Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ScaledSheet, resolveElementText } from '@/components/CertificateCanvasView';
import {
  getDraftTemplate,
  saveDraftTemplate,
  resetDraftTemplate,
  publishTemplate,
  getPublishedTemplate,
  certFontCss,
  CERT_FONTS,
  CERT_FIELD_TOKENS,
} from '@/services/certificateTemplates';
import { newId } from '@/services/ids';
import type { CertificateFieldData } from '@/services/certificates';
import type {
  CertCanvasDesign,
  CertElement,
  CertElementType,
  CertificateActionType,
} from '@/types';

const PT_TO_MM = 25.4 / 72;
const GRID_MM = 1;

/** Sample data used only for live preview of dynamic fields. */
const SAMPLE: CertificateFieldData = {
  fullName: 'ישראל ישראלי',
  systemName: 'מערכת X',
  rankName: 'ב׳',
  actionLabel: 'הסמכה ראשונית',
  issuedAt: '2026-11-10',
  expiresAt: '2027-11-10',
  issuedHebrew: 'כ״ט בחשוון תשפ״ז',
  expiresHebrew: 'י׳ בכסלו תשפ״ח',
  certifierName: 'דנה כהן',
  certifierRole: 'מסמיך',
  number: 'VERO-CERT-000123',
  idType: 'מספר אישי',
  idNumber: '1234567',
  identityLine: 'מספר אישי: 1234567',
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const snap = (mm: number, on: boolean) => (on ? Math.round(mm / GRID_MM) * GRID_MM : mm);

export default function CertificateDesignerPage() {
  const { user: admin } = useAuth();
  const { notify } = useToast();
  const [type, setType] = useState<CertificateActionType>('initial');
  const [loading, setLoading] = useState(true);
  const [design, setDesign] = useState<CertCanvasDesign | null>(null);
  const [draftVersion, setDraftVersion] = useState('1.0');
  const [publishedVersion, setPublishedVersion] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [snapOn, setSnapOn] = useState(true);
  const [dirty, setDirty] = useState(false);

  // Undo/redo stacks of design snapshots.
  const past = useRef<CertCanvasDesign[]>([]);
  const future = useRef<CertCanvasDesign[]>([]);
  const [, forceRerender] = useState(0);

  const actor = admin ? { id: admin.id, full_name: admin.full_name } : { id: '-', full_name: '-' };

  const load = async (t: CertificateActionType) => {
    setLoading(true);
    const draft = await getDraftTemplate(t);
    const pub = await getPublishedTemplate(t);
    past.current = [];
    future.current = [];
    setDesign(draft.design);
    setDraftVersion(draft.version);
    setPublishedVersion(pub?.version ?? null);
    setSelectedId(null);
    setDirty(false);
    setLoading(false);
  };
  useEffect(() => {
    load(type).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // --- history-aware mutation ---
  const record = () => {
    if (design) past.current = [...past.current.slice(-49), design];
    future.current = [];
  };
  const applyDesign = (next: CertCanvasDesign, withHistory = true) => {
    if (withHistory) record();
    setDesign(next);
    setDirty(true);
  };
  const updateEl = (id: string, patch: Partial<CertElement>, withHistory = true) => {
    if (!design) return;
    applyDesign(
      { ...design, elements: design.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) },
      withHistory
    );
  };
  const undo = () => {
    if (!past.current.length || !design) return;
    const prev = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    future.current = [design, ...future.current];
    setDesign(prev);
    setDirty(true);
    forceRerender((n) => n + 1);
  };
  const redo = () => {
    if (!future.current.length || !design) return;
    const next = future.current[0];
    future.current = future.current.slice(1);
    past.current = [...past.current, design];
    setDesign(next);
    setDirty(true);
    forceRerender((n) => n + 1);
  };

  const selected = useMemo(
    () => design?.elements.find((e) => e.id === selectedId) ?? null,
    [design, selectedId]
  );

  // --- add elements ---
  const nextZ = () => (design ? Math.max(0, ...design.elements.map((e) => e.z)) + 1 : 1);
  const addElement = (type: CertElementType, extra: Partial<CertElement> = {}) => {
    if (!design) return;
    const base: CertElement = {
      id: newId(),
      type,
      x: design.width_mm / 2 - 30,
      y: design.height_mm / 2 - 8,
      w: 60,
      h: 16,
      z: nextZ(),
      align: 'center',
      valign: 'middle',
      font_key: 'heebo',
      font_size: 14,
      color: '#0f172a',
      ...extra,
    };
    if (type === 'line') Object.assign(base, { w: 60, h: 0, line_color: '#0f172a', line_width: 0.5 });
    if (type === 'rect') Object.assign(base, { w: 60, h: 30, fill_color: null, border_color: '#1e3a8a', border_width: 0.4 });
    if (type === 'signature') Object.assign(base, { w: 56, h: 22 });
    applyDesign({ ...design, elements: [...design.elements, base] });
    setSelectedId(base.id);
  };

  const onLogo = (file?: File, isImage = true) => {
    if (!file || !design) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = newId();
      applyDesign({
        ...design,
        elements: [
          ...design.elements,
          { id, type: 'image', x: 20, y: 20, w: 30, h: 30, z: nextZ(), src: String(reader.result), keep_aspect: true },
        ],
      });
      setSelectedId(id);
      void isImage;
    };
    reader.readAsDataURL(file);
  };
  const replaceImage = (file?: File) => {
    if (!file || !selected) return;
    const reader = new FileReader();
    reader.onload = () => updateEl(selected.id, { src: String(reader.result) });
    reader.readAsDataURL(file);
  };

  // --- element actions ---
  const del = () => {
    if (!design || !selected) return;
    applyDesign({ ...design, elements: design.elements.filter((e) => e.id !== selected.id) });
    setSelectedId(null);
  };
  const duplicate = () => {
    if (!design || !selected) return;
    const copy: CertElement = { ...selected, id: newId(), x: selected.x + 4, y: selected.y + 4, z: nextZ() };
    applyDesign({ ...design, elements: [...design.elements, copy] });
    setSelectedId(copy.id);
  };
  const bringForward = () => selected && updateEl(selected.id, { z: nextZ() });
  const sendBack = () => {
    if (!design || !selected) return;
    const minZ = Math.min(0, ...design.elements.map((e) => e.z)) - 1;
    updateEl(selected.id, { z: minZ });
  };
  const alignH = (where: 'right' | 'center' | 'left') => {
    if (!design || !selected) return;
    const m = design.margin_mm;
    const x =
      where === 'center'
        ? design.width_mm / 2 - selected.w / 2
        : where === 'right'
          ? design.width_mm - m - selected.w
          : m;
    updateEl(selected.id, { x });
  };
  const alignV = (where: 'top' | 'bottom') => {
    if (!design || !selected) return;
    const m = design.margin_mm;
    const y = where === 'top' ? m : design.height_mm - m - selected.h;
    updateEl(selected.id, { y });
  };

  // --- persistence ---
  const [busy, setBusy] = useState(false);
  const saveDraft = async () => {
    if (!design) return;
    setBusy(true);
    try {
      await saveDraftTemplate(type, design, actor);
      setDirty(false);
      notify('הטיוטה נשמרה', 'ok');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!design) return;
    if (!confirm(`לפרסם את תבנית ה${type === 'renewal' ? 'רענון' : 'הסמכה'} כגרסה ${draftVersion}?\nתעודות שיופקו מעתה ישתמשו בגרסה זו. תעודות שכבר הופקו לא ישתנו.`)) return;
    setBusy(true);
    try {
      await saveDraftTemplate(type, design, actor);
      const pub = await publishTemplate(type, actor);
      notify(`התבנית פורסמה — גרסה ${pub.version}`, 'ok');
      await load(type);
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!confirm('לאפס את הטיוטה לברירת המחדל? פעולה זו אינה משפיעה על תעודות שכבר הופקו.')) return;
    setBusy(true);
    try {
      record();
      const row = await resetDraftTemplate(type, actor);
      setDesign(row.design);
      setDirty(false);
      notify('הטיוטה אופסה', 'ok');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !design) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="עיצוב תעודות — עורך A4"
        subtitle="עורך ויזואלי בסגנון Word. ממקמים אלמנטים על דף A4 לאורך, שומרים טיוטה ומפרסמים גרסה קבועה."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-ink-500">
              טיוטה {draftVersion}
              {publishedVersion ? ` · פורסם ${publishedVersion}` : ' · טרם פורסם'}
            </span>
            <button className="btn-ghost btn-sm gap-1.5" onClick={() => setPreview((p) => !p)}>
              <Icon name="eye" size={15} /> {preview ? 'חזרה לעריכה' : 'תצוגה מקדימה'}
            </button>
            <button className="btn-secondary btn-sm" onClick={saveDraft} disabled={busy}>
              שמור טיוטה
            </button>
            <button className="btn-primary btn-sm" onClick={publish} disabled={busy}>
              פרסם תבנית
            </button>
          </div>
        }
      />

      {/* type tabs */}
      <div className="mb-3 flex items-center gap-2">
        {(['initial', 'renewal'] as const).map((t) => (
          <button
            key={t}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${
              type === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'
            }`}
            onClick={() => setType(t)}
          >
            {t === 'initial' ? 'הסמכה ראשונית' : 'רענון'}
          </button>
        ))}
        {dirty && <span className="text-[12px] text-pending-600">• שינויים שלא נשמרו</span>}
      </div>

      {preview ? (
        <div className="rounded-xl bg-slate-100 p-4">
          <ScaledSheet design={design} data={SAMPLE} signatureData={PLACEHOLDER_SIG} maxWidthPx={620} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <EditorCanvas
            design={design}
            selectedId={selectedId}
            snapOn={snapOn}
            onSelect={setSelectedId}
            onBeginGesture={record}
            onUpdateEl={(id, patch) => updateEl(id, patch, false)}
          />
          <div className="space-y-3">
            <Toolbar
              onAdd={addElement}
              onAddImage={(f) => onLogo(f)}
              onUndo={undo}
              onRedo={redo}
              canUndo={past.current.length > 0}
              canRedo={future.current.length > 0}
              snapOn={snapOn}
              setSnapOn={setSnapOn}
              onReset={reset}
            />
            {selected ? (
              <PropertiesPanel
                el={selected}
                design={design}
                onChange={(patch) => updateEl(selected.id, patch)}
                onDelete={del}
                onDuplicate={duplicate}
                onBringForward={bringForward}
                onSendBack={sendBack}
                onAlignH={alignH}
                onAlignV={alignV}
                onReplaceImage={replaceImage}
              />
            ) : (
              <div className="card p-4 text-[13px] text-ink-500">
                בחרו אלמנט על הדף כדי לערוך אותו, או הוסיפו אלמנט חדש מסרגל הכלים.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const PLACEHOLDER_SIG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="70"><path d="M10 50 L50 20 L90 55 L130 20 L180 45" stroke="%230f172a" stroke-width="3" fill="none"/></svg>'
  );

// ===========================================================================
// Toolbar
// ===========================================================================
function Toolbar({
  onAdd,
  onAddImage,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  snapOn,
  setSnapOn,
  onReset,
}: {
  onAdd: (t: CertElementType, extra?: Partial<CertElement>) => void;
  onAddImage: (f?: File) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  snapOn: boolean;
  setSnapOn: (v: boolean) => void;
  onReset: () => void;
}) {
  const [field, setField] = useState(CERT_FIELD_TOKENS[0].token);
  return (
    <div className="card space-y-2 p-3">
      <div className="text-[12px] font-semibold text-ink-700">הוספת אלמנט</div>
      <div className="grid grid-cols-2 gap-1.5">
        <button className="btn-secondary btn-sm" onClick={() => onAdd('text', { text: 'טקסט חדש' })}>
          + טקסט
        </button>
        <button
          className="btn-secondary btn-sm"
          onClick={() => onAdd('text', { text: 'תיבת טקסט', bg_color: '#f1f5f9', border_color: '#cbd5e1', border_width: 0.3 })}
        >
          + תיבת טקסט
        </button>
        <button className="btn-secondary btn-sm" onClick={() => onAdd('line')}>
          + קו
        </button>
        <button className="btn-secondary btn-sm" onClick={() => onAdd('rect')}>
          + מלבן
        </button>
        <button className="btn-secondary btn-sm" onClick={() => onAdd('signature')}>
          + חתימה
        </button>
        <label className="btn-secondary btn-sm cursor-pointer text-center">
          + תמונה / סמל
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onAddImage(e.target.files?.[0])} />
        </label>
      </div>
      <div className="flex gap-1.5">
        <select className="input !h-9 flex-1 text-[13px]" value={field} onChange={(e) => setField(e.target.value)}>
          {CERT_FIELD_TOKENS.map((t) => (
            <option key={t.token} value={t.token}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          className="btn-secondary btn-sm"
          onClick={() =>
            onAdd('field', {
              field,
              date_mode: field.includes('עברי') ? 'hebrew' : field.includes('תאריך') || field.includes('תוקף') ? 'gregorian' : undefined,
            })
          }
        >
          + שדה
        </button>
      </div>
      <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
        <button className="btn-ghost btn-sm" onClick={onUndo} disabled={!canUndo}>
          ביטול
        </button>
        <button className="btn-ghost btn-sm" onClick={onRedo} disabled={!canRedo}>
          שחזר
        </button>
        <label className="ms-auto flex items-center gap-1.5 text-[12px] text-ink-600">
          <input type="checkbox" className="h-4 w-4" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} />
          הצמד לרשת
        </label>
      </div>
      <button className="btn-ghost btn-sm w-full gap-1.5" onClick={onReset}>
        <Icon name="refresh" size={14} /> אפס לברירת מחדל
      </button>
    </div>
  );
}

// ===========================================================================
// Canvas with drag + resize
// ===========================================================================
function elPxStyle(el: CertElement, scale: number): CSSProperties {
  return {
    position: 'absolute',
    left: el.x * scale,
    top: el.y * scale,
    width: el.w * scale,
    height: (el.type === 'line' ? (el.line_width ?? 0.5) : el.h) * scale,
    zIndex: el.z,
    boxSizing: 'border-box',
  };
}

function EditorCanvas({
  design,
  selectedId,
  snapOn,
  onSelect,
  onBeginGesture,
  onUpdateEl,
}: {
  design: CertCanvasDesign;
  selectedId: string | null;
  snapOn: boolean;
  onSelect: (id: string | null) => void;
  onBeginGesture: () => void;
  onUpdateEl: (id: string, patch: Partial<CertElement>) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(2);
  const [guide, setGuide] = useState<{ vx?: number; hy?: number }>({});
  const gesture = useRef<null | {
    id: string;
    mode: 'move' | string; // 'move' or handle like 'se'
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    ow: number;
    oh: number;
  }>(null);

  useEffect(() => {
    const update = () => {
      const w = wrapRef.current?.clientWidth ?? 600;
      setScale(Math.max(1, (w - 2) / design.width_mm));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [design.width_mm]);

  const px2mm = (px: number) => px / scale;

  const onPointerMove = (e: RPE) => {
    const g = gesture.current;
    if (!g) return;
    const el = design.elements.find((x) => x.id === g.id);
    if (!el) return;
    const dxmm = px2mm(e.clientX - g.sx);
    const dymm = px2mm(e.clientY - g.sy);
    if (g.mode === 'move') {
      let nx = snap(g.ox + dxmm, snapOn);
      let ny = snap(g.oy + dymm, snapOn);
      nx = clamp(nx, 0, design.width_mm - el.w);
      ny = clamp(ny, 0, design.height_mm - el.h);
      // center guides
      const cx = nx + el.w / 2;
      const cy = ny + el.h / 2;
      const ng: { vx?: number; hy?: number } = {};
      if (Math.abs(cx - design.width_mm / 2) < 1.2) {
        nx = design.width_mm / 2 - el.w / 2;
        ng.vx = design.width_mm / 2;
      }
      if (Math.abs(cy - design.height_mm / 2) < 1.2) {
        ny = design.height_mm / 2 - el.h / 2;
        ng.hy = design.height_mm / 2;
      }
      setGuide(ng);
      onUpdateEl(g.id, { x: nx, y: ny });
    } else {
      // resize by handle (n,s,e,w combos)
      let { ox: x, oy: y, ow: w, oh: h } = g;
      const hdl = g.mode;
      if (hdl.includes('e')) w = g.ow + dxmm;
      if (hdl.includes('w')) {
        w = g.ow - dxmm;
        x = g.ox + dxmm;
      }
      if (hdl.includes('s')) h = g.oh + dymm;
      if (hdl.includes('n')) {
        h = g.oh - dymm;
        y = g.oy + dymm;
      }
      w = Math.max(4, snap(w, snapOn));
      h = Math.max(el.type === 'line' ? 0 : 4, snap(h, snapOn));
      x = clamp(x, 0, design.width_mm - 4);
      y = clamp(y, 0, design.height_mm - 4);
      onUpdateEl(g.id, { x, y, w, h });
    }
  };
  const endGesture = () => {
    gesture.current = null;
    setGuide({});
  };

  const startMove = (e: RPE, el: CertElement) => {
    if (el.locked) {
      onSelect(el.id);
      return;
    }
    e.stopPropagation();
    onSelect(el.id);
    onBeginGesture();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    gesture.current = { id: el.id, mode: 'move', sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h };
  };
  const startResize = (e: RPE, el: CertElement, hdl: string) => {
    e.stopPropagation();
    onSelect(el.id);
    onBeginGesture();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    gesture.current = { id: el.id, mode: hdl, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h };
  };

  const els = [...design.elements].sort((a, b) => a.z - b.z);
  const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];

  return (
    <div ref={wrapRef} className="overflow-auto rounded-xl bg-slate-200 p-3">
      <div
        className="relative mx-auto bg-white shadow-md"
        style={{ width: design.width_mm * scale, height: design.height_mm * scale, background: design.bg_color }}
        onPointerDown={() => onSelect(null)}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerLeave={endGesture}
      >
        {/* safe print area */}
        <div
          aria-hidden
          className="pointer-events-none absolute border border-dashed border-sky-300"
          style={{
            left: design.margin_mm * scale,
            top: design.margin_mm * scale,
            width: (design.width_mm - 2 * design.margin_mm) * scale,
            height: (design.height_mm - 2 * design.margin_mm) * scale,
          }}
        />
        {/* center guides */}
        {guide.vx !== undefined && (
          <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-rose-400" style={{ left: guide.vx * scale }} />
        )}
        {guide.hy !== undefined && (
          <div className="pointer-events-none absolute left-0 right-0 h-px bg-rose-400" style={{ top: guide.hy * scale }} />
        )}

        {els.map((el) => {
          const sel = el.id === selectedId;
          return (
            <div key={el.id} style={elPxStyle(el, scale)}>
              <div
                className={`h-full w-full ${el.locked ? 'cursor-default' : 'cursor-move'} ${sel ? 'outline outline-2 outline-brand-500' : 'outline outline-1 outline-transparent hover:outline-slate-300'}`}
                onPointerDown={(e) => startMove(e, el)}
              >
                <ElementVisual el={el} scale={scale} />
              </div>
              {el.locked && (
                <span className="absolute -top-2 -right-2 rounded bg-slate-700 p-0.5 text-white">
                  <Icon name="lock" size={10} />
                </span>
              )}
              {sel && !el.locked &&
                handles.map((h) => (
                  <span
                    key={h}
                    onPointerDown={(e) => startResize(e, el, h)}
                    className="absolute z-50 h-2.5 w-2.5 rounded-sm border border-white bg-brand-600"
                    style={handlePos(h)}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function handlePos(h: string): CSSProperties {
  const s: CSSProperties = { position: 'absolute' };
  const mid = 'calc(50% - 5px)';
  if (h.includes('n')) s.top = -5;
  if (h.includes('s')) s.bottom = -5;
  if (h.includes('e')) s.right = -5;
  if (h.includes('w')) s.left = -5;
  if (h === 'n' || h === 's') s.left = mid;
  if (h === 'e' || h === 'w') s.top = mid;
  s.cursor = `${h}-resize`;
  return s;
}

/** Non-interactive visual of an element, rendered at px scale (edit mode). */
function ElementVisual({ el, scale }: { el: CertElement; scale: number }) {
  if (el.type === 'line') {
    return <div style={{ width: '100%', height: '100%', background: el.line_color ?? '#0f172a' }} />;
  }
  if (el.type === 'rect') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: el.fill_color ?? 'transparent',
          border: el.border_color ? `${(el.border_width ?? 0.3) * scale}px solid ${el.border_color}` : '1px dashed #cbd5e1',
          borderRadius: 2,
        }}
      />
    );
  }
  if (el.type === 'image' || el.type === 'signature') {
    const src = el.type === 'signature' ? PLACEHOLDER_SIG : el.src ?? undefined;
    if (!src)
      return (
        <div className="flex h-full w-full items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400">
          {el.type === 'signature' ? 'חתימה' : 'תמונה'}
        </div>
      );
    return <img src={src} alt="" className="h-full w-full" style={{ objectFit: el.keep_aspect === false ? 'fill' : 'contain' }} />;
  }
  // text / field
  const justify = el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center';
  const items = el.valign === 'top' ? 'flex-start' : el.valign === 'bottom' ? 'flex-end' : 'center';
  return (
    <div
      dir="rtl"
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: items,
        alignItems: justify,
        textAlign: (el.align ?? 'center') as CSSProperties['textAlign'],
        fontFamily: certFontCss(el.font_key),
        fontSize: (el.font_size ?? 12) * PT_TO_MM * scale,
        fontWeight: el.bold ? 700 : 400,
        fontStyle: el.italic ? 'italic' : 'normal',
        textDecoration: el.underline ? 'underline' : 'none',
        color: el.color ?? '#0f172a',
        background: el.bg_color ?? 'transparent',
        border: el.border_color ? `${(el.border_width ?? 0.3) * scale}px solid ${el.border_color}` : 'none',
        lineHeight: 1.35,
        whiteSpace: 'pre-line',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
        padding: `0 ${1 * scale}px`,
      }}
    >
      {el.type === 'field' ? resolveElementText(el, SAMPLE) : el.text}
    </div>
  );
}

// ===========================================================================
// Properties panel
// ===========================================================================
function PropertiesPanel({
  el,
  design,
  onChange,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBack,
  onAlignH,
  onAlignV,
  onReplaceImage,
}: {
  el: CertElement;
  design: CertCanvasDesign;
  onChange: (patch: Partial<CertElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringForward: () => void;
  onSendBack: () => void;
  onAlignH: (w: 'right' | 'center' | 'left') => void;
  onAlignV: (w: 'top' | 'bottom') => void;
  onReplaceImage: (f?: File) => void;
}) {
  const isText = el.type === 'text';
  const isField = el.type === 'field';
  const isTextLike = isText || isField;
  const num = (v: number) => Math.round(v * 10) / 10;

  return (
    <div className="card space-y-3 p-3 text-[13px]">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink-800">מאפייני אלמנט</span>
        <button
          className={`rounded-md border px-2 py-1 text-[12px] ${el.locked ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 text-slate-600'}`}
          onClick={() => onChange({ locked: !el.locked })}
        >
          <Icon name="lock" size={12} /> {el.locked ? 'נעול' : 'קבע מיקום'}
        </button>
      </div>

      {isText && (
        <div>
          <label className="label">טקסט</label>
          <textarea className="input min-h-[60px]" value={el.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
      )}
      {isField && (
        <div>
          <label className="label">שדה דינמי</label>
          <select className="input" value={el.field ?? ''} onChange={(e) => onChange({ field: e.target.value })}>
            {CERT_FIELD_TOKENS.map((t) => (
              <option key={t.token} value={t.token}>
                {t.label}
              </option>
            ))}
          </select>
          {(el.field?.includes('תאריך') || el.field?.includes('תוקף')) && (
            <select className="input mt-1.5" value={el.date_mode ?? 'gregorian'} onChange={(e) => onChange({ date_mode: e.target.value as CertElement['date_mode'] })}>
              <option value="gregorian">לועזי</option>
              <option value="hebrew">עברי</option>
              <option value="both">שניהם</option>
            </select>
          )}
        </div>
      )}

      {isTextLike && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">גופן</label>
              <select className="input" value={el.font_key ?? 'heebo'} onChange={(e) => onChange({ font_key: e.target.value })}>
                {CERT_FONTS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">גודל (pt)</label>
              <input type="number" className="input" value={el.font_size ?? 14} onChange={(e) => onChange({ font_size: clamp(Number(e.target.value) || 12, 6, 96) })} />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <ToggleBtn on={!!el.bold} onClick={() => onChange({ bold: !el.bold })} label="B" bold />
            <ToggleBtn on={!!el.italic} onClick={() => onChange({ italic: !el.italic })} label="I" italic />
            <ToggleBtn on={!!el.underline} onClick={() => onChange({ underline: !el.underline })} label="U" underline />
            <input type="color" className="ms-auto h-8 w-10 rounded" value={el.color ?? '#0f172a'} onChange={(e) => onChange({ color: e.target.value })} title="צבע טקסט" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">יישור אופקי</label>
              <div className="flex gap-1">
                {(['right', 'center', 'left'] as const).map((a) => (
                  <button key={a} className={`flex-1 rounded border py-1 ${el.align === a ? 'border-brand-500 bg-brand-50' : 'border-slate-300'}`} onClick={() => onChange({ align: a })}>
                    {a === 'right' ? '→' : a === 'center' ? '↔' : '←'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">יישור אנכי</label>
              <div className="flex gap-1">
                {(['top', 'middle', 'bottom'] as const).map((a) => (
                  <button key={a} className={`flex-1 rounded border py-1 ${el.valign === a ? 'border-brand-500 bg-brand-50' : 'border-slate-300'}`} onClick={() => onChange({ valign: a })}>
                    {a === 'top' ? '↑' : a === 'middle' ? '•' : '↓'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4" checked={el.bg_color != null} onChange={(e) => onChange({ bg_color: e.target.checked ? '#f1f5f9' : null })} />
              רקע
            </label>
            {el.bg_color != null && <input type="color" className="h-8 w-10 rounded" value={el.bg_color} onChange={(e) => onChange({ bg_color: e.target.value })} />}
          </div>
        </>
      )}

      {el.type === 'line' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">עובי (מ״מ)</label>
            <input type="number" step="0.1" className="input" value={el.line_width ?? 0.5} onChange={(e) => onChange({ line_width: clamp(Number(e.target.value) || 0.5, 0.1, 10) })} />
          </div>
          <div>
            <label className="label">צבע</label>
            <input type="color" className="h-9 w-full rounded" value={el.line_color ?? '#0f172a'} onChange={(e) => onChange({ line_color: e.target.value })} />
          </div>
        </div>
      )}

      {el.type === 'rect' && (
        <>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4" checked={el.fill_color != null} onChange={(e) => onChange({ fill_color: e.target.checked ? '#eef2ff' : null })} />
              מילוי
            </label>
            {el.fill_color != null && <input type="color" className="h-8 w-10 rounded" value={el.fill_color} onChange={(e) => onChange({ fill_color: e.target.value })} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">צבע מסגרת</label>
              <input type="color" className="h-9 w-full rounded" value={el.border_color ?? '#1e3a8a'} onChange={(e) => onChange({ border_color: e.target.value })} />
            </div>
            <div>
              <label className="label">עובי מסגרת</label>
              <input type="number" step="0.1" className="input" value={el.border_width ?? 0.4} onChange={(e) => onChange({ border_width: clamp(Number(e.target.value) || 0.4, 0, 10) })} />
            </div>
          </div>
        </>
      )}

      {(el.type === 'image' || isTextLike || el.type === 'rect') && el.type === 'image' && (
        <div className="flex items-center justify-between">
          <label className="btn-secondary btn-sm cursor-pointer">
            החלף תמונה
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onReplaceImage(e.target.files?.[0])} />
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="h-4 w-4" checked={el.keep_aspect !== false} onChange={(e) => onChange({ keep_aspect: e.target.checked })} />
            שמור יחס
          </label>
        </div>
      )}

      {/* geometry */}
      <div className="grid grid-cols-4 gap-1.5">
        {(['x', 'y', 'w', 'h'] as const).map((k) => (
          <div key={k}>
            <label className="label !text-[11px]">{k.toUpperCase()}</label>
            <input
              type="number"
              className="input !px-1.5 text-[12px]"
              value={num(el[k])}
              onChange={(e) => onChange({ [k]: clamp(Number(e.target.value) || 0, 0, k === 'x' || k === 'w' ? design.width_mm : design.height_mm) } as Partial<CertElement>)}
            />
          </div>
        ))}
      </div>

      {/* alignment within page */}
      <div>
        <label className="label">יישור בדף</label>
        <div className="flex flex-wrap gap-1">
          <button className="rounded border border-slate-300 px-2 py-1" onClick={() => onAlignH('right')}>ימין</button>
          <button className="rounded border border-slate-300 px-2 py-1" onClick={() => onAlignH('center')}>מרכז</button>
          <button className="rounded border border-slate-300 px-2 py-1" onClick={() => onAlignH('left')}>שמאל</button>
          <button className="rounded border border-slate-300 px-2 py-1" onClick={() => onAlignV('top')}>למעלה</button>
          <button className="rounded border border-slate-300 px-2 py-1" onClick={() => onAlignV('bottom')}>למטה</button>
        </div>
      </div>

      {/* layers + actions */}
      <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-2">
        <button className="btn-ghost btn-sm gap-1" onClick={onBringForward}><Icon name="up" size={13} /> קדימה</button>
        <button className="btn-ghost btn-sm gap-1" onClick={onSendBack}><Icon name="down" size={13} /> אחורה</button>
        <button className="btn-ghost btn-sm gap-1" onClick={onDuplicate}><Icon name="layers" size={13} /> שכפל</button>
        <button className="btn-ghost btn-sm gap-1 text-fault-600" onClick={onDelete}><Icon name="trash" size={13} /> מחק</button>
      </div>
    </div>
  );
}

function ToggleBtn({ on, onClick, label, bold, italic, underline }: { on: boolean; onClick: () => void; label: string; bold?: boolean; italic?: boolean; underline?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 w-8 rounded border text-[14px] ${on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'}`}
      style={{ fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal', textDecoration: underline ? 'underline' : 'none' }}
    >
      {label}
    </button>
  );
}
