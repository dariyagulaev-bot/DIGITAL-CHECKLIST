import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Modal } from '@/components/ui';
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { listPendingRenewals, approveRenewal, rejectRenewal } from '@/services/certRenewals';
import type { CertRenewal } from '@/types';

/** "רענונים ממתינים לאישור" — the approver's queue (scoped to what they may approve). */
export default function RenewalsApprovalPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [rows, setRows] = useState<CertRenewal[]>([]);
  const [open, setOpen] = useState<CertRenewal | null>(null);
  const [sigEmpty, setSigEmpty] = useState(true);
  const [busy, setBusy] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  const load = useCallback(async () => { if (user) setRows(await listPendingRenewals(user)); }, [user]);
  useEffect(() => { load(); }, [load]);

  const approve = async () => {
    if (!user || !open) return;
    if (sigEmpty) { notify('נדרשת חתימת המאשר לאישור החידוש', 'error'); return; }
    setBusy(true);
    try {
      const sig = padRef.current?.toDataURL() ?? null;
      const role = user.roles?.join(', ');
      await approveRenewal(open.id, user, sig, role);
      notify(`הסמכתו של ${open.user_name} חודשה`, 'ok');
      setOpen(null); await load();
    } catch (e) { notify((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const reject = async () => {
    if (!user || !open) return;
    const reason = prompt('סיבת הדחייה:');
    if (reason == null) return;
    setBusy(true);
    try {
      await rejectRenewal(open.id, user, reason.trim() || '—');
      notify('הרענון נדחה', 'info');
      setOpen(null); await load();
    } catch (e) { notify((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="pt-1">
        <h1 className="text-[22px] font-extrabold text-navy-900">רענונים ממתינים לאישור</h1>
        <p className="mt-0.5 text-[14px] text-ink-500">מבחני רענון שעברו (80+) וממתינים לאישורך לחידוש ההסמכה.</p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-ink-400">אין רענונים הממתינים לאישורך.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <button key={r.id} onClick={() => { setOpen(r); setSigEmpty(true); }} className="card flex w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-slate-50/60">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-ink-900">{r.user_name}</div>
                <div className="text-[12.5px] text-ink-500">{r.system_name} · {r.rank_name} · בוצע {fmt(r.submitted_at)}</div>
              </div>
              <span className="nums rounded-full border border-ok-200 bg-ok-50 px-2.5 py-1 text-[12.5px] font-bold text-ok-700">ציון {r.score}</span>
              <span className="text-[12.5px] text-ink-400">ממתין</span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <Modal open onClose={() => setOpen(null)} title={`חידוש הסמכה — ${open.user_name}`} maxWidth="max-w-lg"
          footer={
            <div className="flex w-full gap-2">
              <button className="btn-primary flex-1 gap-1.5" disabled={busy} onClick={approve}><Icon name="check" size={16} /> אשר חידוש הסמכה</button>
              <button className="btn-ghost text-fault-600" disabled={busy} onClick={reject}>דחה</button>
            </div>
          }>
          <div className="space-y-1.5 text-[13.5px]">
            <Line label="מערכת" value={open.system_name ?? '—'} />
            <Line label="דרג" value={open.rank_name ?? '—'} />
            <Line label="תוקף נוכחי" value={open.prev_expires_at ? fmt(open.prev_expires_at) : 'ללא'} />
            <Line label="מבחן רענון" value="עבר" />
            <Line label="ציון" value={`${open.score}/100`} />
            <Line label="תאריך ביצוע" value={fmt(open.submitted_at)} />
            <Line label="גרסת מבחן" value={open.exam_version} />
          </div>
          <div className="mt-4">
            <div className="mb-1 text-[13px] font-semibold text-ink-700">חתימת המאשר</div>
            <SignaturePad ref={padRef} onChange={(empty: boolean) => setSigEmpty(empty)} />
            <p className="mt-1 text-[12px] text-ink-400">האישור מתעד את שמך, תפקידך, תאריך ושעה וחתימתך. ההסמכה תחודש רק לאחר האישור.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between border-b border-slate-100 py-1.5"><span className="text-ink-500">{label}</span><span className="font-semibold text-ink-800">{value}</span></div>;
}
function fmt(d: string): string {
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return d;
  const x = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`;
}
