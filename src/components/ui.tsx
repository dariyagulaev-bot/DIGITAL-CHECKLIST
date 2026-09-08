import { type ReactNode, useEffect } from 'react';
import { FormStatus } from '@/types';
import { statusLabel } from '@/exports/labels';

export function StatusBadge({ status }: { status: FormStatus }) {
  const map: Record<FormStatus, string> = {
    [FormStatus.DRAFT]: 'bg-slate-100 text-slate-600',
    [FormStatus.IN_PROGRESS]: 'bg-brand-100 text-brand-700',
    [FormStatus.PENDING_APPROVAL]: 'bg-pending-100 text-pending-700',
    [FormStatus.APPROVED]: 'bg-ok-100 text-ok-700',
    [FormStatus.REJECTED]: 'bg-fault-100 text-fault-700',
  };
  const dot: Record<FormStatus, string> = {
    [FormStatus.DRAFT]: 'bg-slate-400',
    [FormStatus.IN_PROGRESS]: 'bg-brand-500',
    [FormStatus.PENDING_APPROVAL]: 'bg-pending-500',
    [FormStatus.APPROVED]: 'bg-ok-500',
    [FormStatus.REJECTED]: 'bg-fault-500',
  };
  return (
    <span className={`badge ${map[status]}`}>
      <span className={`h-2 w-2 rounded-full ${dot[status]}`} />
      {statusLabel(status)}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-500" />
      {label && <div className="text-sm">{label}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className={`card w-full ${maxWidth} p-6 max-h-[90vh] overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <button
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            aria-label="סגור"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-slate-500">
      <div className="text-5xl">{icon}</div>
      <div className="text-lg font-semibold text-slate-600">{title}</div>
      {hint && <div className="text-sm">{hint}</div>}
    </div>
  );
}

export function Toast({ message, kind }: { message: string; kind: 'ok' | 'error' | 'info' }) {
  const styles = {
    ok: 'bg-ok-600',
    error: 'bg-fault-600',
    info: 'bg-brand-600',
  }[kind];
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 no-print">
      <div className={`${styles} rounded-xl px-5 py-3 text-white shadow-soft`}>{message}</div>
    </div>
  );
}
