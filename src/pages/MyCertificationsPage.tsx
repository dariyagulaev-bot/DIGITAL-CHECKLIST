import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { listCertifications, certStatus } from '@/services/certifications';
import { renewalAvailable, startRenewal, listRenewalsForUser } from '@/services/certRenewals';
import { listSystems } from '@/services/systems';
import { listRanks } from '@/services/ranks';
import { remainingLabel, todayStr } from '@/services/dates';
import type { CertRenewal, Rank, System, UserSystemRank } from '@/types';

interface Row {
  cert: UserSystemRank;
  systemName: string;
  rankName: string;
  status: ReturnType<typeof certStatus>;
  hasExam: boolean;
  pending?: CertRenewal;
}

export default function MyCertificationsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const [certs, systems, ranks, renewals] = await Promise.all([
      listCertifications(user.id), listSystems(true), listRanks(true), listRenewalsForUser(user.id),
    ]);
    const sName = (id: string) => systems.find((s: System) => s.id === id)?.name ?? '—';
    const rName = (id: string | null) => ranks.find((r: Rank) => r.id === id)?.name ?? '—';
    const out: Row[] = [];
    for (const cert of certs) {
      const av = await renewalAvailable(cert);
      out.push({
        cert, systemName: sName(cert.system_id), rankName: rName(cert.max_rank_id), status: certStatus(cert),
        hasExam: !!av.exam, pending: renewals.find((r) => r.cert_id === cert.id && r.status === 'pending_approval'),
      });
    }
    setRows(out);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const doRenew = async (row: Row) => {
    if (!user) return;
    try {
      const attemptId = await startRenewal(user, row.cert);
      nav(`/exam/take/${attemptId}`);
    } catch (e) { notify((e as Error).message, 'error'); }
  };

  return (
    <div className="space-y-5">
      <div className="pt-1">
        <h1 className="text-[22px] font-extrabold text-navy-900">ההסמכות שלי</h1>
        <p className="mt-0.5 text-[14px] text-ink-500">מצב ההסמכות שלך ורענון כשמתקרב מועד הפקיעה.</p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-ink-400">אין לך הסמכות רשומות.</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.cert.id} className={`card p-4 ${row.status === 'needs_renewal' || row.status === 'expired' ? 'border-pending-200' : ''}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <StatusDot status={row.status} pending={!!row.pending} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold text-ink-900">{row.systemName} — {row.rankName}</div>
                  <div className="text-[12.5px] text-ink-500">
                    {row.cert.expires_at ? <>תוקף עד {fmt(row.cert.expires_at)} · {remainingLabel(todayStr(), row.cert.expires_at)}</> : 'ללא תאריך תפוגה'}
                  </div>
                </div>
                <RowAction row={row} onRenew={() => doRenew(row)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RowAction({ row, onRenew }: { row: Row; onRenew: () => void }) {
  if (row.pending) {
    return <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[12.5px] font-medium text-brand-700">מבחן רענון הושלם · ממתין לאישור</span>;
  }
  if (row.status === 'needs_renewal' || row.status === 'expired') {
    if (!row.hasExam) return <span className="text-[12.5px] text-ink-400">טרם הוגדר מבחן רענון</span>;
    return <button className="btn-primary btn-sm gap-1.5" onClick={onRenew}><Icon name="refresh" size={15} /> בצע רענון</button>;
  }
  return <span className="rounded-full border border-ok-200 bg-ok-50 px-3 py-1.5 text-[12.5px] font-medium text-ok-700">בתוקף</span>;
}

function StatusDot({ status, pending }: { status: ReturnType<typeof certStatus>; pending: boolean }) {
  const cls = pending ? 'bg-brand-500' : status === 'expired' ? 'bg-fault-500' : status === 'needs_renewal' ? 'bg-pending-500' : 'bg-ok-500';
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} />;
}

function fmt(d: string): string {
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return d;
  const x = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`;
}
