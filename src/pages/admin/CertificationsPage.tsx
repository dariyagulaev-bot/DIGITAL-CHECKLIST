import { useEffect, useMemo, useState } from 'react';
import {
  listCertificationsDetailed,
  certificationSummary,
  setCertification,
  renewCertification,
  type CertDetail,
  type CertSummary,
} from '@/services/certifications';
import { listRanks } from '@/services/ranks';
import { getCertValidityMonths, setCertValidityMonths } from '@/services/settings';
import { dots, remainingLabel, todayStr, addMonths } from '@/services/dates';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Modal, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { CertStatus, Rank } from '@/types';

const STATUS_META: Record<CertStatus, { label: string; cls: string }> = {
  valid: { label: 'בתוקף', cls: 'bg-ok-100 text-ok-700' },
  needs_renewal: { label: 'נדרש רענון', cls: 'bg-pending-100 text-pending-700' },
  expired: { label: 'פג תוקף', cls: 'bg-fault-100 text-fault-700' },
  none: { label: '—', cls: 'bg-slate-100 text-slate-500' },
};

type StatusFilter = 'all' | CertStatus;

export default function CertificationsPage() {
  const { user: admin } = useAuth();
  const { notify } = useToast();
  const [rows, setRows] = useState<CertDetail[] | null>(null);
  const [summary, setSummary] = useState<CertSummary | null>(null);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [defMonths, setDefMonths] = useState(12);
  const [q, setQ] = useState('');
  const [sysFilter, setSysFilter] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<CertDetail | null>(null);

  const load = async () => {
    const [detail, sum, rnk, dm] = await Promise.all([
      listCertificationsDetailed(),
      certificationSummary(),
      listRanks(true),
      getCertValidityMonths(),
    ]);
    setRows(detail);
    setSummary(sum);
    setRanks(rnk);
    setDefMonths(dm);
  };
  useEffect(() => {
    load();
  }, []);

  const systems = useMemo(() => {
    const m = new Map<string, string>();
    (rows ?? []).forEach((r) => m.set(r.system_id, r.system_name));
    return [...m.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    return (rows ?? []).filter((r) => {
      if (q && !r.user_name.includes(q.trim())) return false;
      if (sysFilter && r.system_id !== sysFilter) return false;
      if (rankFilter && r.cert.max_rank_id !== rankFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, q, sysFilter, rankFilter, statusFilter]);

  const upcoming = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => r.status === 'needs_renewal')
        .sort((a, b) => (a.expires_at ?? '').localeCompare(b.expires_at ?? ''))
        .slice(0, 6),
    [rows]
  );

  const saveDefault = async (n: number) => {
    await setCertValidityMonths(n);
    setDefMonths(n);
    notify('תוקף ברירת המחדל נשמר', 'ok');
  };

  if (rows === null || !summary) return <Spinner />;

  const StatCard = ({ label, value, cls, onClick }: { label: string; value: number; cls: string; onClick: () => void }) => (
    <button onClick={onClick} className={`card flex-1 p-4 text-right transition-colors hover:border-slate-300`}>
      <div className={`text-3xl font-bold ${cls}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-700">ניהול הסמכות</h2>
        <label className="flex items-center gap-2 text-sm text-ink-600">
          תוקף ברירת מחדל (חודשים):
          <input
            type="number"
            min={1}
            className="input !min-h-0 w-24 !py-1.5"
            defaultValue={defMonths}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0 && n !== defMonths) saveDefault(n);
            }}
          />
        </label>
      </div>

      {/* Dashboard counts (clickable filters) */}
      <div className="flex flex-wrap gap-3">
        <StatCard label="סה״כ הסמכות" value={summary.total} cls="text-slate-700" onClick={() => setStatusFilter('all')} />
        <StatCard label="בתוקף" value={summary.valid} cls="text-ok-600" onClick={() => setStatusFilter('valid')} />
        <StatCard label="דורשות רענון ב-3 חודשים" value={summary.needsRenewal} cls="text-pending-600" onClick={() => setStatusFilter('needs_renewal')} />
        <StatCard label="פגות תוקף" value={summary.expired} cls="text-fault-600" onClick={() => setStatusFilter('expired')} />
      </div>

      {summary.needsRenewal > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-pending-200 bg-pending-50 px-4 py-2.5 text-[14px] font-semibold text-pending-700">
          <Icon name="alert" size={18} /> {summary.needsRenewal} הסמכות דורשות רענון ב-3 החודשים הקרובים
        </div>
      )}

      {/* Upcoming to expire */}
      {upcoming.length > 0 && (
        <section className="card p-4">
          <div className="mb-2 text-sm font-bold text-slate-700">הסמכות הקרובות לפקיעה</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-right text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="p-2">שם</th><th className="p-2">מערכת</th><th className="p-2">דרג</th><th className="p-2">תפוגה</th><th className="p-2">זמן שנותר</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((r) => (
                  <tr key={r.cert.id} className="border-b border-slate-100">
                    <td className="p-2 font-medium text-ink-800">{r.user_name}</td>
                    <td className="p-2">{r.system_name}</td>
                    <td className="p-2">{r.rank_name}</td>
                    <td className="p-2 nums">{dots(r.expires_at)}</td>
                    <td className="p-2 text-pending-700">{r.expires_at ? remainingLabel(todayStr(), r.expires_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input className="input !min-h-0 w-48 !py-1.5" placeholder="חיפוש משתמש…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !min-h-0 w-40 !py-1.5" value={sysFilter} onChange={(e) => setSysFilter(e.target.value)}>
          <option value="">כל המערכות</option>
          {systems.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select className="input !min-h-0 w-36 !py-1.5" value={rankFilter} onChange={(e) => setRankFilter(e.target.value)}>
          <option value="">כל הדרגים</option>
          {ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className="input !min-h-0 w-36 !py-1.5" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="all">כל הסטטוסים</option>
          <option value="valid">בתוקף</option>
          <option value="needs_renewal">נדרש רענון</option>
          <option value="expired">פג תוקף</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-right text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="p-3">משתמש</th>
              <th className="p-3">מערכת</th>
              <th className="p-3">דרג הסמכה מרבי</th>
              <th className="p-3">תאריך הסמכה/רענון</th>
              <th className="p-3">תפוגה</th>
              <th className="p-3">סטטוס</th>
              <th className="p-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.cert.id} className="border-b border-slate-100">
                <td className="p-3 font-medium text-slate-800">
                  {r.user_name}
                  {!r.user_active && <span className="mr-1 text-xs text-slate-400">(מושבת)</span>}
                </td>
                <td className="p-3">{r.system_name}</td>
                <td className="p-3">{r.rank_name}</td>
                <td className="p-3 nums">{dots(r.issued_at)}</td>
                <td className="p-3 nums">{dots(r.expires_at)}</td>
                <td className="p-3"><span className={`badge ${STATUS_META[r.status].cls}`}>{STATUS_META[r.status].label}</span></td>
                <td className="p-3">
                  <button className="link" onClick={() => setEditing(r)}>ערוך / חדש</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">אין הסמכות התואמות את הסינון</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && admin && (
        <CertEditor
          detail={editing}
          ranks={ranks}
          defMonths={defMonths}
          actor={{ id: admin.id, full_name: admin.full_name }}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          notify={notify}
        />
      )}
    </div>
  );
}

function CertEditor({
  detail,
  ranks,
  defMonths,
  actor,
  onClose,
  onSaved,
  notify,
}: {
  detail: CertDetail;
  ranks: Rank[];
  defMonths: number;
  actor: { id: string; full_name: string };
  onClose: () => void;
  onSaved: () => void;
  notify: (m: string, k?: 'ok' | 'error' | 'info') => void;
}) {
  const [maxRankId, setMaxRankId] = useState(detail.cert.max_rank_id);
  const [issued, setIssued] = useState(detail.issued_at ?? todayStr());
  const [months, setMonths] = useState(detail.validity_months ?? defMonths);
  const [busy, setBusy] = useState(false);
  const expiresPreview = months > 0 && issued ? addMonths(issued, months) : '—';
  const ranksAsc = [...ranks].sort((a, b) => a.sort_order - b.sort_order);

  const save = async (renewToday = false) => {
    setBusy(true);
    try {
      if (renewToday) {
        await renewCertification(detail.user_id, detail.system_id, todayStr(), actor, months);
      } else {
        await setCertification(detail.user_id, detail.system_id, maxRankId, actor, {
          issuedAt: issued,
          validityMonths: months,
        });
      }
      notify('ההסמכה עודכנה', 'ok');
      onSaved();
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${detail.user_name} · ${detail.system_name}`}
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={() => save(false)}>שמור</button>
          <button type="button" className="btn-secondary gap-1.5" disabled={busy} onClick={() => save(true)} title="עדכן תאריך רענון להיום ומחשב תפוגה חדשה">
            <Icon name="refresh" size={16} /> חדש להיום
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>ביטול</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">דרג הסמכה מרבי</label>
          <select className="input" value={maxRankId} onChange={(e) => setMaxRankId(e.target.value)}>
            {ranksAsc.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-ink-400">דרג גבוה כולל אוטומטית את כל הדרגים שתחתיו.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">תאריך הסמכה / רענון אחרון</label>
            <input type="date" className="input" value={issued} onChange={(e) => setIssued(e.target.value)} />
          </div>
          <div>
            <label className="label">תוקף (חודשים)</label>
            <input type="number" min={1} className="input" value={months} onChange={(e) => setMonths(Number(e.target.value))} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-ink-700">
          תאריך תפוגה מחושב: <span className="font-bold nums">{dots(expiresPreview)}</span>
        </div>
      </div>
    </Modal>
  );
}
