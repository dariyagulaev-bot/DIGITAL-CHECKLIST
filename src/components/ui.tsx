import { type ReactNode, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { FormStatus } from '@/types';
import { statusLabel } from '@/exports/labels';
import { Icon, type IconName } from './Icon';

const STATUS_STYLE: Record<FormStatus, { cls: string; icon: IconName }> = {
  [FormStatus.DRAFT]: { cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: 'file' },
  [FormStatus.IN_PROGRESS]: { cls: 'bg-brand-50 text-brand-700 border-brand-100', icon: 'pen' },
  [FormStatus.PENDING_APPROVAL]: {
    cls: 'bg-pending-50 text-pending-700 border-pending-200',
    icon: 'clock',
  },
  [FormStatus.APPROVED]: { cls: 'bg-ok-50 text-ok-700 border-ok-200', icon: 'shield-check' },
  [FormStatus.REJECTED]: { cls: 'bg-fault-50 text-fault-700 border-fault-200', icon: 'alert' },
};

export function StatusBadge({ status }: { status: FormStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`badge ${s.cls}`}>
      <Icon name={s.icon} size={13} />
      {statusLabel(status)}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-400">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-600" />
      {label && <div className="text-sm font-medium">{label}</div>}
    </div>
  );
}

const TONE: Record<string, { bg: string; text: string; icon: IconName }> = {
  neutral: { bg: 'bg-slate-100', text: 'text-ink-500', icon: 'file' },
  primary: { bg: 'bg-brand-50', text: 'text-brand-700', icon: 'sparkle' },
  fault: { bg: 'bg-fault-50', text: 'text-fault-600', icon: 'alert' },
  ok: { bg: 'bg-ok-50', text: 'text-ok-600', icon: 'check' },
  lock: { bg: 'bg-pending-50', text: 'text-pending-700', icon: 'lock' },
};

/** Subtle "grab me" grip shown next to a draggable modal's title. */
function GripHint() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      className="shrink-0 text-slate-300"
      aria-hidden="true"
    >
      <g fill="currentColor">
        <circle cx="4" cy="3" r="1.25" />
        <circle cx="10" cy="3" r="1.25" />
        <circle cx="4" cy="7" r="1.25" />
        <circle cx="10" cy="7" r="1.25" />
        <circle cx="4" cy="11" r="1.25" />
        <circle cx="10" cy="11" r="1.25" />
      </g>
    </svg>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
  tone = 'primary',
  icon,
  draggable = false,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  tone?: keyof typeof TONE;
  icon?: IconName;
  /** Turn the modal into a floating window that can be dragged by its header. */
  draggable?: boolean;
  /** A fixed footer (kept out of the scrolling body) — used with draggable. */
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; left: number; top: number; w: number } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Each fresh open starts centered — position is never persisted.
  useEffect(() => {
    if (open) {
      setPos(null);
      setDragging(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // ---- Drag, only from the header, only off non-interactive areas ----
  const onHeaderPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggable) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return; // left button only
      const el = e.target as HTMLElement;
      // Never start a drag from a control the header may contain.
      if (el.closest('button, a, input, textarea, select, [data-no-drag]')) return;
      const panel = panelRef.current;
      if (!panel) return;
      const r = panel.getBoundingClientRect();
      dragRef.current = { sx: e.clientX, sy: e.clientY, left: r.left, top: r.top, w: r.width };
      setPos({ left: r.left, top: r.top });
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [draggable]
  );

  const onHeaderPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const KEEP = 96; // keep at least this much of the window on screen horizontally
    const HEADER = 52; // keep the header band reachable at the bottom edge
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = d.left + (e.clientX - d.sx);
    let top = d.top + (e.clientY - d.sy);
    left = Math.min(Math.max(left, KEEP - d.w), vw - KEEP);
    top = Math.min(Math.max(top, 8), vh - HEADER);
    setPos({ left, top });
  }, []);

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  }, []);

  if (!open) return null;
  const t = TONE[tone];

  const headerInner = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${t.bg} ${t.text}`}>
        <Icon name={icon ?? t.icon} size={19} />
      </span>
      {draggable && <GripHint />}
      <h2 className="flex-1 text-[17px] font-bold text-ink-900">{title}</h2>
      <button
        className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-slate-100 hover:text-ink-600"
        onClick={onClose}
        aria-label="סגור"
        style={{ cursor: 'pointer' }}
      >
        <Icon name="x" size={18} />
      </button>
    </>
  );

  // ---- Draggable: floating window with fixed header/footer + scrolling body ----
  if (draggable) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/45 p-4 anim-fade-in"
        onClick={onClose}
      >
        <div
          ref={panelRef}
          className={`anim-scale-in flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-modal`}
          style={pos ? { position: 'fixed', left: pos.left, top: pos.top, margin: 0 } : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex shrink-0 select-none items-center gap-2.5 border-b border-slate-100 px-5 py-3.5"
            style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
            onPointerDown={onHeaderPointerDown}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {headerInner}
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
          {footer && <div className="shrink-0 border-t border-slate-100 px-5 py-3.5">{footer}</div>}
        </div>
      </div>
    );
  }

  // ---- Default modal (unchanged) ----
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/45 p-4 anim-fade-in"
      onClick={onClose}
    >
      <div
        className={`anim-scale-in w-full ${maxWidth} max-h-[92vh] overflow-auto rounded-lg border border-slate-200 bg-white p-5 shadow-modal`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2.5">{headerInner}</div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-ink-400">
        <Icon name={icon} size={24} />
      </span>
      <div className="text-[15px] font-bold text-ink-800">{title}</div>
      {hint && <div className="max-w-sm text-[13.5px] text-ink-500">{hint}</div>}
    </div>
  );
}

export function Toast({ message, kind }: { message: string; kind: 'ok' | 'error' | 'info' }) {
  const conf = {
    ok: { bg: 'bg-ok-600', icon: 'check' as IconName },
    error: { bg: 'bg-fault-600', icon: 'alert' as IconName },
    info: { bg: 'bg-navy-800', icon: 'sparkle' as IconName },
  }[kind];
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 no-print animate-slide-up">
      <div className={`${conf.bg} flex items-center gap-2 rounded-md px-4 py-2.5 text-white shadow-modal`}>
        <Icon name={conf.icon} size={17} />
        <span className="text-[14px] font-semibold">{message}</span>
      </div>
    </div>
  );
}
