import { type ReactNode, useEffect } from 'react';
import { FormStatus } from '@/types';
import { statusLabel } from '@/exports/labels';
import { Icon, type IconName } from './Icon';

const STATUS_STYLE: Record<FormStatus, { cls: string; icon: IconName }> = {
  [FormStatus.DRAFT]: { cls: 'bg-slate-100 text-slate-600', icon: 'file' },
  [FormStatus.IN_PROGRESS]: { cls: 'bg-brand-50 text-brand-700', icon: 'pen' },
  [FormStatus.PENDING_APPROVAL]: { cls: 'bg-pending-100 text-pending-700', icon: 'clock' },
  [FormStatus.APPROVED]: { cls: 'bg-ok-100 text-ok-700', icon: 'shield-check' },
  [FormStatus.REJECTED]: { cls: 'bg-fault-100 text-fault-700', icon: 'alert' },
};

export function StatusBadge({ status }: { status: FormStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`badge ${s.cls}`}>
      <Icon name={s.icon} size={14} />
      {statusLabel(status)}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-500" />
      {label && <div className="text-sm font-medium">{label}</div>}
    </div>
  );
}

const TONE: Record<string, { ring: string; bg: string; text: string; icon: IconName }> = {
  neutral: { ring: 'ring-slate-200', bg: 'bg-slate-100', text: 'text-slate-600', icon: 'file' },
  primary: { ring: 'ring-brand-100', bg: 'bg-brand-50', text: 'text-brand-600', icon: 'sparkle' },
  fault: { ring: 'ring-fault-100', bg: 'bg-fault-50', text: 'text-fault-600', icon: 'alert' },
  ok: { ring: 'ring-ok-100', bg: 'bg-ok-50', text: 'text-ok-600', icon: 'check' },
  lock: { ring: 'ring-pending-100', bg: 'bg-pending-50', text: 'text-pending-600', icon: 'lock' },
};

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
  tone = 'primary',
  icon,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  tone?: keyof typeof TONE;
  icon?: IconName;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const t = TONE[tone];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/45 p-4 backdrop-blur-sm anim-fade-in"
      onClick={onClose}
    >
      <div
        className={`card anim-scale-in w-full ${maxWidth} max-h-[92vh] overflow-auto p-6 shadow-lift`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${t.bg} ${t.text} ${t.ring}`}>
            <Icon name={icon ?? t.icon} size={22} />
          </span>
          <h2 className="flex-1 text-xl font-extrabold text-ink-900">{title}</h2>
          <button
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            aria-label="סגור"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
        <Icon name={icon} size={30} />
      </span>
      <div className="text-lg font-bold text-ink-800">{title}</div>
      {hint && <div className="max-w-sm text-sm text-slate-500">{hint}</div>}
    </div>
  );
}

export function Toast({ message, kind }: { message: string; kind: 'ok' | 'error' | 'info' }) {
  const conf = {
    ok: { bg: 'bg-ok-600', icon: 'check' as IconName },
    error: { bg: 'bg-fault-600', icon: 'alert' as IconName },
    info: { bg: 'bg-ink-900', icon: 'sparkle' as IconName },
  }[kind];
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 no-print anim-slide-up">
      <div className={`${conf.bg} flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-white shadow-lift`}>
        <Icon name={conf.icon} size={18} />
        <span className="font-bold">{message}</span>
      </div>
    </div>
  );
}
