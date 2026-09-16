import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface PerformerSelection {
  id: string;
  name: string;
}

/** Minimal shape needed to pick a second performer — a real user (id + name). */
export interface PerformerOption {
  id: string;
  full_name: string;
}

interface Props {
  /** Active performer users to choose from (loaded from the local DB — offline). */
  options: PerformerOption[];
  /** Currently selected performer id (null when none chosen yet). */
  value: string | null;
  /** Snapshot of the chosen name (shown even if that user was later disabled). */
  valueName: string;
  /** User id of מבצע 1 — may never be selected as מבצע 2 (no self-selection). */
  excludeId?: string;
  /** Full name of מבצע 1 — extra guard so two performers are two different people. */
  excludeName?: string;
  disabled?: boolean;
  onChange: (selection: PerformerSelection) => void;
}

/**
 * Large, touch-friendly searchable dropdown for choosing מבצע 2 on a Zebra
 * tablet. Fully offline: it only renders the performers passed in from the
 * local database. Prevents picking מבצע 1 as the second performer.
 */
export const PerformerSelect = forwardRef<HTMLButtonElement, Props>(function PerformerSelect(
  { options, value, valueName, excludeId, excludeName, disabled, onChange },
  ref
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  // People available to pick: active performer users, excluding מבצע 1 (by id,
  // and by name as a fallback) so a performer can never select themselves.
  const selectable = useMemo(() => {
    const ex = excludeName?.trim().toLowerCase();
    return options.filter(
      (p) => p.id !== excludeId && (!ex || p.full_name.trim().toLowerCase() !== ex)
    );
  }, [options, excludeId, excludeName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return selectable;
    return selectable.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [selectable, query]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const choose = (p: PerformerOption) => {
    onChange({ id: p.id, name: p.full_name });
    setQuery('');
    setOpen(false);
  };

  const hasSelection = !!(value && valueName);

  return (
    <div ref={boxRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        ref={ref}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex min-h-[42px] w-full items-center gap-2 rounded-md border px-3 text-right text-[14px] transition-colors ${
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-ink-400'
            : hasSelection
              ? 'border-slate-300 bg-white text-ink-800 hover:border-brand-400'
              : 'border-slate-300 bg-white text-ink-400 hover:border-brand-400'
        }`}
      >
        <Icon name="search" size={16} className="shrink-0 text-ink-400" />
        <span className={`flex-1 truncate ${hasSelection ? 'font-semibold text-ink-800' : ''}`}>
          {hasSelection ? valueName : 'חפש או בחר מבצע'}
        </span>
        {!disabled && <Icon name="down" size={16} className="shrink-0 text-ink-400" />}
      </button>

      {/* Dropdown panel */}
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5">
              <Icon name="search" size={16} className="shrink-0 text-ink-400" />
              <input
                autoFocus
                className="w-full bg-transparent py-2.5 text-[14px] outline-none"
                placeholder="חפש לפי שם…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-[13px] text-ink-400">
                {selectable.length === 0
                  ? 'אין מבצעים פעילים מוגדרים במערכת'
                  : 'לא נמצא מבצע תואם'}
              </li>
            ) : (
              filtered.map((p) => {
                const active = p.id === value;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => choose(p)}
                      className={`flex w-full items-center gap-2.5 px-3 py-3 text-right text-[14px] transition-colors hover:bg-brand-50 ${
                        active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-800'
                      }`}
                    >
                      <Icon name="users" size={16} className="shrink-0 text-ink-400" />
                      <span className="flex-1 truncate">{p.full_name}</span>
                      {active && <Icon name="check" size={16} className="shrink-0 text-brand-600" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
});
