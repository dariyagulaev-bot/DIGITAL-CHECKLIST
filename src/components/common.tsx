import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { shekels, monthLabel, addMonths } from '../lib/format';
import type { Agorot, MonthKey } from '../data/types';

export function Money({ a, className, sign }: { a: Agorot; className?: string; sign?: boolean }) {
  const neg = a < 0;
  return (
    <span className={'money' + (className ? ' ' + className : '')}>
      <span className="num">{neg ? '−' : sign && a > 0 ? '+' : ''}{shekels(Math.abs(a))}</span>
      <span className="cur">₪</span>
    </span>
  );
}

export function Bar({ ratio, tone, thick }: { ratio: number; tone?: 'neg' | 'muted'; thick?: boolean }) {
  const w = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className={'bar' + (thick ? ' thick' : '')} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(w)}>
      <span className={tone ?? ''} style={{ width: `${w}%` }} />
    </div>
  );
}

export function MonthSwitcher({ month, onChange }: { month: MonthKey; onChange: (m: MonthKey) => void }) {
  return (
    <div className="month">
      <button className="ibtn" aria-label="חודש קודם" onClick={() => onChange(addMonths(month, -1))}><Icon name="chev-r" size={20} /></button>
      <h1>{monthLabel(month)}</h1>
      <button className="ibtn" aria-label="חודש הבא" onClick={() => onChange(addMonths(month, 1))}><Icon name="chev-l" size={20} /></button>
    </div>
  );
}

export function AppBar({ title, back, children }: { title: ReactNode; back?: () => void; children?: ReactNode }) {
  return (
    <header className="appbar">
      <div className="appbar-start">
        {back && <button className="ibtn" aria-label="חזרה" onClick={back}><Icon name="chev-r" size={20} /></button>}
        {typeof title === 'string' ? <h1>{title}</h1> : title}
      </div>
      {children && <div className="appbar-end">{children}</div>}
    </header>
  );
}

/** Keeps a component mounted briefly after `open` turns false so it can animate out. */
function usePresence(open: boolean, ms = 220) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted, shown };
}

export function Sheet({ open, onClose, children, label, tall }: {
  open: boolean; onClose: () => void; children: ReactNode; label: string; tall?: boolean;
}) {
  const { mounted, shown } = usePresence(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  return (
    <>
      <div className={'scrim' + (shown ? ' shown' : '')} onClick={onClose} />
      <div className={'sheet' + (shown ? ' shown' : '') + (tall ? ' tall' : '')} role="dialog" aria-modal="true" aria-label={label}>
        <div className="grabber" />
        {children}
      </div>
    </>
  );
}

export function SheetBar({ title, onClose, back, end }: { title: string; onClose?: () => void; back?: () => void; end?: ReactNode }) {
  return (
    <div className="sheet-bar">
      {back
        ? <button className="ibtn" aria-label="חזרה" onClick={back}><Icon name="chev-r" size={20} /></button>
        : <button className="ibtn" aria-label="סגירה" onClick={onClose}><Icon name="x" size={20} /></button>}
      <h3>{title}</h3>
      <div className="sheet-bar-end">{end}</div>
    </div>
  );
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ opts, onResult }: { opts: ConfirmOptions | null; onResult: (ok: boolean) => void }) {
  const { mounted, shown } = usePresence(!!opts, 160);
  const [last, setLast] = useState<ConfirmOptions | null>(opts);
  useEffect(() => { if (opts) setLast(opts); }, [opts]);
  if (!mounted || !last) return null;
  return (
    <div className={'dialog-wrap' + (shown ? ' shown' : '')} onClick={() => onResult(false)}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" onClick={e => e.stopPropagation()}>
        <h3 id="dlg-title">{last.title}</h3>
        {last.message && <p>{last.message}</p>}
        <div className="dialog-actions">
          <button className="btn" onClick={() => onResult(false)}>ביטול</button>
          <button className={'btn ' + (last.danger ? 'danger' : 'primary')} onClick={() => onResult(true)} autoFocus>
            {last.confirmLabel ?? 'אישור'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        {hint && <span className="toggle-hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}

export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="fieldset">
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

/** Text input for money amounts (whole shekels or with agorot). */
export function AmountInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="amount-input">
      <input
        id={id}
        className="field"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder ?? '0'}
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
      />
      <span className="amount-input-cur">₪</span>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-ic"><Icon name={icon} /></span>
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
      {action}
    </div>
  );
}
