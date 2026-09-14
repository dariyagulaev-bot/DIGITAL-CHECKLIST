import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canApprove, isAdmin } from '@/services/rbac';
import { getFormStats, listAllForms, listFormsByPerformer } from '@/services/forms';
import { exportFormToExcel } from '@/exports/excel';
import { PageHeader } from '@/components/Layout';
import { EmptyState, Spinner, StatusBadge } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { formatDate, statusLabel } from '@/exports/labels';
import { FormStatus, type CompletedForm } from '@/types';

interface Row extends CompletedForm {
  taskCount: number;
  faultCount: number;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('ALL');
  const [faultsOnly, setFaultsOnly] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!user) return;
    const loader =
      isAdmin(user) || canApprove(user) ? listAllForms() : listFormsByPerformer(user.id);
    loader
      .then(async (forms) => {
        const withStats = await Promise.all(
          forms.map(async (f) => ({ ...f, ...(await getFormStats(f.id)) }))
        );
        setRows(withStats);
      })
      .catch(() => setRows([]));
  }, [user]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle) {
        const hay = `${r.name} ${r.number} ${r.performer_name} ${r.performer2_name ?? ''} ${r.approver_name ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (status !== 'ALL' && r.status !== status) return false;
      if (faultsOnly && r.faultCount === 0) return false;
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
  }, [rows, q, status, faultsOnly, from, to]);

  const excel = async (id: string) => {
    try {
      await exportFormToExcel(id);
      notify('קובץ Excel נוצר', 'ok');
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  if (!user) return null;

  return (
    <div>
      <PageHeader title="היסטוריית בד״חים" subtitle="חיפוש, צפייה והפקת דוחות" />

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="label">חיפוש</label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="שם, מספר, מבצע או מאשר…"
            />
          </div>
          <div>
            <label className="label">סטטוס</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">הכל</option>
              {Object.values(FormStatus).map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 py-3">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={faultsOnly}
                onChange={(e) => setFaultsOnly(e.target.checked)}
              />
              <span className="text-sm font-medium text-slate-600">עם תקלות בלבד</span>
            </label>
          </div>
          <div>
            <label className="label">מתאריך</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">עד תאריך</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {rows === null ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon="history" title="לא נמצאו בד״חים" hint="נסה לשנות את מסנני החיפוש" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="p-3 font-semibold">תאריך</th>
                <th className="p-3 font-semibold">שם בד״ח</th>
                <th className="p-3 font-semibold">מספר</th>
                <th className="p-3 font-semibold">מבצעים</th>
                <th className="p-3 font-semibold">מאשר</th>
                <th className="p-3 font-semibold">בדיקות</th>
                <th className="p-3 font-semibold">תקלות</th>
                <th className="p-3 font-semibold">סטטוס</th>
                <th className="p-3 font-semibold">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="p-3 font-medium text-slate-800">{r.name}</td>
                  <td className="p-3">{r.number || '—'}</td>
                  <td className="p-3">
                    {r.performer_name}
                    {r.performer2_name ? `, ${r.performer2_name}` : ''}
                  </td>
                  <td className="p-3">{r.approver_name || '—'}</td>
                  <td className="p-3 text-center">{r.taskCount}</td>
                  <td className={`p-3 text-center ${r.faultCount ? 'font-bold text-fault-600' : ''}`}>
                    {r.faultCount}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Link to={`/view/${r.id}`} className="link">
                        צפה
                      </Link>
                      <span className="text-slate-300">|</span>
                      <button className="link" onClick={() => excel(r.id)}>
                        Excel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
