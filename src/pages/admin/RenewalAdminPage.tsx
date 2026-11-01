import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useToast } from '@/context/ToastContext';
import { listUsersWithRoles } from '@/services/auth';
import { listSystems } from '@/services/systems';
import { listRanks } from '@/services/ranks';
import {
  renewalDashboard, listApprovers, addApprover, removeApprover, listAllRenewals,
  type RenewalDashboard,
} from '@/services/certRenewals';
import type { CertRenewal, Rank, RenewalApprover, System, UserWithRoles } from '@/types';

export default function RenewalAdminPage() {
  const { notify } = useToast();
  const [dash, setDash] = useState<RenewalDashboard | null>(null);
  const [approvers, setApprovers] = useState<RenewalApprover[]>([]);
  const [renewals, setRenewals] = useState<CertRenewal[]>([]);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [filter, setFilter] = useState<'all' | CertRenewal['status']>('all');
  // new approver form
  const [nu, setNu] = useState(''); const [ns, setNs] = useState(''); const [nr, setNr] = useState('');

  const load = useCallback(async () => {
    setDash(await renewalDashboard());
    setApprovers(await listApprovers());
    setRenewals(await listAllRenewals());
  }, []);
  useEffect(() => {
    load();
    listUsersWithRoles().then(setUsers);
    listSystems(true).then(setSystems);
    listRanks(true).then(setRanks);
  }, [load]);

  const uName = (id: string) => users.find((u) => u.id === id)?.full_name ?? id;
  const sName = (id?: string | null) => (id ? systems.find((s) => s.id === id)?.name ?? id : 'כל המערכות');
  const rName = (id?: string | null) => (id ? ranks.find((r) => r.id === id)?.name ?? id : 'כל הדרגים');

  const add = async () => {
    if (!nu) { notify('בחרו משתמש', 'error'); return; }
    await addApprover({ user_id: nu, user_name: uName(nu), system_id: ns || null, rank_id: nr || null });
    setNu(''); setNs(''); setNr('');
    await load();
  };

  const shown = renewals.filter((r) => filter === 'all' || r.status === filter);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink-900">רענונים</h2>
        <p className="text-[13px] text-ink-500">מעקב אחר רענוני הסמכה, מאשרים מורשים ותור האישורים.</p>
      </div>

      {/* Dashboard */}
      {dash && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat color="fault" n={dash.expired} label="הסמכות שפגו" />
          <Stat color="pending" n={dash.expiring_no_renewal} label="עומדות לפוג · ללא רענון" />
          <Stat color="brand" n={dash.pending_approval} label="ממתינים לאישור" />
          <Stat color="ok" n={dash.approved_recent} label="רענונים שאושרו" />
        </div>
      )}
      <Link to="/renewals" className="inline-flex items-center gap-1.5 text-[13px] link"><Icon name="clock" size={15} /> מעבר לתור האישורים שלי</Link>

      {/* Approvers */}
      <section className="card p-4">
        <div className="mb-2 text-[15px] font-bold text-ink-900">מאשרי רענון מורשים</div>
        <p className="mb-3 text-[12.5px] text-ink-500">הגדירו מי רשאי לאשר רענונים, לפי מערכת ו/או דרג. היות מנהל אינו מעניק הרשאת אישור אוטומטית.</p>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div><label className="label">משתמש</label>
            <select className="input !min-h-0 !py-1.5" value={nu} onChange={(e) => setNu(e.target.value)}>
              <option value="">בחר…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div><label className="label">מערכת</label>
            <select className="input !min-h-0 !py-1.5" value={ns} onChange={(e) => setNs(e.target.value)}>
              <option value="">כל המערכות</option>
              {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="label">דרג</label>
            <select className="input !min-h-0 !py-1.5" value={nr} onChange={(e) => setNr(e.target.value)}>
              <option value="">כל הדרגים</option>
              {ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <button className="btn-secondary btn-sm gap-1.5" onClick={add}><Icon name="plus" size={14} /> הוסף מאשר</button>
        </div>
        {approvers.length === 0 ? (
          <p className="text-[13px] text-ink-400">לא הוגדרו מאשרים.</p>
        ) : (
          <div className="space-y-1.5">
            {approvers.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-[13px]">
                <span className="font-semibold text-ink-800">{a.user_name ?? uName(a.user_id)}</span>
                <span className="text-ink-500">{sName(a.system_id)} · {rName(a.rank_id)}</span>
                <button className="link mr-auto text-fault-600" onClick={async () => { await removeApprover(a.id); await load(); }}>הסר</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Renewal records */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[15px] font-bold text-ink-900">רשומות רענון</div>
          <select className="input !min-h-0 w-40 !py-1.5 text-[13px]" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">כל הסטטוסים</option>
            <option value="pending_approval">ממתין לאישור</option>
            <option value="approved">אושר</option>
            <option value="rejected">נדחה</option>
          </select>
        </div>
        {shown.length === 0 ? (
          <p className="text-[13px] text-ink-400">אין רשומות.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-right text-[13px]">
              <thead><tr className="border-b border-slate-200 text-ink-500">
                <th className="p-2 font-semibold">משתמש</th><th className="p-2 font-semibold">מערכת / דרג</th><th className="p-2 font-semibold">ציון</th><th className="p-2 font-semibold">תאריך</th><th className="p-2 font-semibold">סטטוס</th><th className="p-2 font-semibold">מאשר</th>
              </tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="p-2 font-semibold text-ink-800">{r.user_name}</td>
                    <td className="p-2 text-ink-600">{r.system_name} · {r.rank_name}</td>
                    <td className="p-2 nums">{r.score}</td>
                    <td className="p-2 text-ink-600">{fmt(r.submitted_at)}</td>
                    <td className="p-2"><Badge s={r.status} /></td>
                    <td className="p-2 text-ink-600">{r.approved_by_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ color, n, label }: { color: 'fault' | 'pending' | 'brand' | 'ok'; n: number; label: string }) {
  const c = { fault: 'text-fault-600', pending: 'text-pending-600', brand: 'text-brand-600', ok: 'text-ok-600' }[color];
  return <div className="card px-3 py-3 text-center"><div className={`nums text-[24px] font-extrabold ${c}`}>{n}</div><div className="mt-0.5 text-[12px] text-ink-500">{label}</div></div>;
}
function Badge({ s }: { s: CertRenewal['status'] }) {
  const map = { pending_approval: ['border-brand-200 bg-brand-50 text-brand-700', 'ממתין לאישור'], approved: ['border-ok-200 bg-ok-50 text-ok-700', 'אושר'], rejected: ['border-fault-200 bg-fault-50 text-fault-700', 'נדחה'] } as const;
  const [cls, label] = map[s];
  return <span className={`rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${cls}`}>{label}</span>;
}
function fmt(d: string): string {
  const t = Date.parse(d); if (!Number.isFinite(t)) return d;
  const x = new Date(t); const p = (n: number) => String(n).padStart(2, '0');
  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`;
}
