import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner, EmptyState, Modal } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { Icon } from '@/components/Icon';
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { canManageTracking, listAllTrackingFaults, keepInTracking, closeTracking } from '@/services/trackingFaults';
import type { TrackingEvent, TrackingFault, TrackingRepairStatus } from '@/types';

const REPAIR_LABEL: Record<TrackingRepairStatus, string> = {
  not_repaired: '✕ טרם תוקנה',
  repaired: '✓ תוקנה',
  repair_approved: '✓ תוקנה ואושרה',
};
const EVENT_LABEL: Record<TrackingEvent['kind'], string> = {
  opened: 'התקלה נפתחה',
  defined: 'הוגדרה כתקלה במעקב',
  repair_reported: 'בוצע תיקון',
  repair_approved: 'התיקון אושר',
  rechecked: 'נבדקה שוב',
  kept: 'הוחלט להמשיך מעקב',
  note: 'הערה',
  closed: 'המעקב נסגר',
};

function fmt(d?: string): string {
  if (!d) return '—';
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return d;
  const x = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()} ${p(x.getHours())}:${p(x.getMinutes())}`;
}

export default function TrackingFaultsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [rows, setRows] = useState<TrackingFault[] | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'active' | 'closed' | 'all'>('active');
  const [repair, setRepair] = useState<'all' | TrackingRepairStatus>('all');
  const [open, setOpen] = useState<TrackingFault | null>(null);

  const load = useCallback(async () => setRows(await listAllTrackingFaults()), []);
  useEffect(() => { load(); }, [load]);

  const canManage = canManageTracking(user);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows.filter((t) => {
      if (status !== 'all' && t.tracking_status !== status) return false;
      if (repair !== 'all' && t.repair_status !== repair) return false;
      if (needle) {
        const hay = `${t.unit_name} ${t.system_name} ${t.description} ${t.source_form_number} ${t.source_rank_name} ${t.reported_by_name ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, status, repair]);

  if (!user) return null;

  return (
    <div>
      <PageHeader title="תקלות במעקב" subtitle="מעקב אחר תקלות פעילות לפי מספר מערכת" />

      <div className="card mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="label">חיפוש</label>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="מספר מערכת, מערכת, תקלה, בד״ח…" />
          </div>
          <div>
            <label className="label">מצב מעקב</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="active">פעיל</option>
              <option value="closed">נסגר</option>
              <option value="all">הכל</option>
            </select>
          </div>
          <div>
            <label className="label">מצב תיקון</label>
            <select className="input" value={repair} onChange={(e) => setRepair(e.target.value as typeof repair)}>
              <option value="all">הכל</option>
              <option value="not_repaired">טרם תוקנה</option>
              <option value="repaired">תוקנה</option>
              <option value="repair_approved">תוקנה ואושרה</option>
            </select>
          </div>
        </div>
      </div>

      {rows === null ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon="shield-check" title="אין תקלות במעקב" hint="תקלה נכנסת למעקב רק לאחר הגדרה מפורשת" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="p-3 font-semibold">מספר מערכת</th>
                <th className="p-3 font-semibold">מערכת</th>
                <th className="p-3 font-semibold">תקלה</th>
                <th className="p-3 font-semibold">דרג מקור</th>
                <th className="p-3 font-semibold">מצב תיקון</th>
                <th className="p-3 font-semibold">מצב מעקב</th>
                <th className="p-3 font-semibold">תאריך</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => setOpen(t)}>
                  <td className="p-3 font-semibold text-ink-800"><bdi>{t.unit_name}</bdi></td>
                  <td className="p-3">{t.system_name}</td>
                  <td className="p-3 max-w-[260px] truncate">{t.description}</td>
                  <td className="p-3 whitespace-nowrap">{t.source_rank_name}</td>
                  <td className={`p-3 whitespace-nowrap ${t.repair_status === 'not_repaired' ? 'text-fault-600' : 'text-ok-600'}`}>{REPAIR_LABEL[t.repair_status]}</td>
                  <td className="p-3 whitespace-nowrap">{t.tracking_status === 'active' ? '🟠 במעקב' : '✓ נסגר'}</td>
                  <td className="p-3 whitespace-nowrap">{fmt(t.opened_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <DetailModal
          fault={open}
          canManage={canManage}
          onClose={() => setOpen(null)}
          onDone={async () => { setOpen(null); await load(); }}
          notify={notify}
          actor={user}
        />
      )}
    </div>
  );
}

function DetailModal({ fault, canManage, onClose, onDone, notify, actor }: {
  fault: TrackingFault;
  canManage: boolean;
  onClose: () => void;
  onDone: () => void;
  notify: (m: string, k?: 'ok' | 'error' | 'info') => void;
  actor: { id: string; full_name: string };
}) {
  const [mode, setMode] = useState<'view' | 'keep' | 'close'>('view');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  const doKeep = async () => {
    setBusy(true);
    try { await keepInTracking(fault.id, actor as never, note); notify('הושאר במעקב', 'ok'); onDone(); }
    catch (e) { notify((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const doClose = async () => {
    setBusy(true);
    try {
      const signature = sigRef.current?.isEmpty() ? null : sigRef.current?.toDataURL() ?? null;
      await closeTracking(fault.id, actor as never, { note, signature, role: 'מאשר' });
      notify('המעקב נסגר', 'ok'); onDone();
    } catch (e) { notify((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="פרטי תקלה במעקב" maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-[15px] font-bold text-ink-900">{fault.description}</div>
          <div className="mt-2 grid gap-x-4 gap-y-1 text-[13px] text-ink-600 sm:grid-cols-2">
            <div><span className="font-semibold">מספר מערכת:</span> <bdi>{fault.unit_name}</bdi></div>
            <div><span className="font-semibold">מערכת:</span> {fault.system_name}</div>
            <div><span className="font-semibold">בד״ח מקור:</span> <bdi>{fault.source_form_number}</bdi></div>
            <div><span className="font-semibold">דרג מקור:</span> {fault.source_rank_name}</div>
            <div><span className="font-semibold">דיווח:</span> {fault.reported_by_name ?? '—'}</div>
            <div><span className="font-semibold">הוגדר למעקב ע״י:</span> {fault.defined_by_name}</div>
            <div><span className="font-semibold">מצב תיקון:</span> {REPAIR_LABEL[fault.repair_status]}</div>
            <div><span className="font-semibold">מצב מעקב:</span> {fault.tracking_status === 'active' ? '🟠 במעקב' : '✓ נסגר'}</div>
          </div>
          {fault.notes && <div className="mt-2 text-[13px] text-ink-600"><span className="font-semibold">הערות:</span> {fault.notes}</div>}
          {fault.images?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {fault.images.map((src, i) => <img key={i} src={src} alt="" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />)}
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-1.5 text-[13px] font-bold text-ink-700">היסטוריית מעקב</div>
          <ol className="space-y-1.5 border-r-2 border-slate-100 pr-3">
            {fault.events.map((e) => (
              <li key={e.id} className="relative text-[12.5px]">
                <span className="absolute -right-[18px] top-1 h-2 w-2 rounded-full bg-slate-300 ring-2 ring-white" />
                <span className="font-semibold text-ink-700">{EVENT_LABEL[e.kind]}</span>
                <span className="text-ink-400"> · {fmt(e.at)} · {e.actor_name}</span>
                {e.note && <div className="text-ink-500">{e.note}</div>}
              </li>
            ))}
          </ol>
        </div>

        {fault.tracking_status === 'closed' && (
          <div className="rounded-lg border border-ok-200 bg-ok-50 p-3 text-[13px] text-ok-800">
            המעקב נסגר ע״י {fault.closed_by_name} ({fault.closed_by_role || 'מאשר'}) ב-{fmt(fault.closed_at)}{fault.close_note ? ` · ${fault.close_note}` : ''}
          </div>
        )}

        {canManage && fault.tracking_status === 'active' && (
          <div className="border-t border-slate-100 pt-3">
            {mode === 'view' && (
              <div className="flex gap-2">
                <button className="btn-secondary btn-sm gap-1.5" onClick={() => { setMode('keep'); setNote(''); }}><Icon name="clock" size={15} /> השאר במעקב</button>
                <button className="btn-primary btn-sm gap-1.5" onClick={() => { setMode('close'); setNote(''); }}><Icon name="check" size={15} /> סגור מעקב</button>
              </div>
            )}
            {mode === 'keep' && (
              <div className="space-y-2">
                <label className="label">הערת בדיקה (רשות)</label>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="נבדק — תקין כרגע, להמשיך מעקב" autoFocus />
                <div className="flex gap-2">
                  <button className="btn-primary btn-sm" disabled={busy} onClick={doKeep}>אישור — השאר במעקב</button>
                  <button className="btn-ghost btn-sm" onClick={() => setMode('view')}>ביטול</button>
                </div>
              </div>
            )}
            {mode === 'close' && (
              <div className="space-y-2">
                <label className="label">הערת סגירה</label>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="התקלה טופלה ואומתה — סגירת מעקב" autoFocus />
                <label className="label">חתימה (רשות)</label>
                <SignaturePad ref={sigRef} />
                <div className="flex gap-2">
                  <button className="btn-primary btn-sm" disabled={busy} onClick={doClose}>סגור מעקב</button>
                  <button className="btn-ghost btn-sm" onClick={() => setMode('view')}>ביטול</button>
                </div>
              </div>
            )}
          </div>
        )}
        {!canManage && fault.tracking_status === 'active' && (
          <p className="text-[12.5px] text-ink-400">רק מאשר בעל הרשאה יכול לסגור או להשאיר מעקב.</p>
        )}
      </div>
    </Modal>
  );
}
