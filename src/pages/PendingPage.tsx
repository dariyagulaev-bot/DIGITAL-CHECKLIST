import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getFormStats, listPendingApproval, listInTreatment } from '@/services/forms';
import { isUserCertified } from '@/services/certifications';
import { isAdmin } from '@/services/rbac';
import { PageHeader } from '@/components/Layout';
import { EmptyState, Spinner } from '@/components/ui';
import { FormTitle } from '@/components/FormTitle';
import { formatTimeHM, formatStamp } from '@/exports/labels';
import type { CompletedForm } from '@/types';

export default function PendingPage() {
  const { user } = useAuth();
  const [forms, setForms] = useState<CompletedForm[] | null>(null);
  const [treatment, setTreatment] = useState<CompletedForm[]>([]);
  const [stats, setStats] = useState<Record<string, { taskCount: number; faultCount: number }>>({});

  useEffect(() => {
    listPendingApproval()
      .then(async (list) => {
        setForms(list);
        const entries = await Promise.all(
          list.map(async (f) => [f.id, await getFormStats(f.id)] as const)
        );
        setStats(Object.fromEntries(entries));
      })
      .catch(() => setForms([]));
  }, []);

  // Treatment inbox: IN_TREATMENT forms the logged-in user may treat (certified
  // for the system at the treating rank), or all of them for an admin.
  useEffect(() => {
    if (!user) return;
    listInTreatment()
      .then(async (list) => {
        if (isAdmin(user)) {
          setTreatment(list);
          return;
        }
        const mine: CompletedForm[] = [];
        for (const f of list) {
          if (await isUserCertified(user.id, f.system_id, f.treatment_rank_id ?? null)) mine.push(f);
        }
        setTreatment(mine);
      })
      .catch(() => setTreatment([]));
  }, [user]);

  if (!user) return null;

  return (
    <div>
      {treatment.length > 0 && (
        <div className="mb-6">
          <PageHeader title="בטיפול דרג מטפל" subtitle="בד״חים שהועברו לטיפולך" />
          <div className="grid gap-3 sm:grid-cols-2">
            {treatment.map((f) => (
              <div key={f.id} className="card border-r-2 border-r-pending-500 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <FormTitle form={f} className="text-[15px] font-bold text-slate-800" />
                    <div className="mt-0.5 text-sm text-slate-500">
                      הועבר ע״י {f.transferred_by_name || '—'} · {formatStamp(f.transferred_at)}
                    </div>
                  </div>
                  <span className="badge bg-pending-100 text-pending-700">
                    {f.treatment_rank_name || 'דרג מטפל'}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Link to={`/form/${f.id}`} className="btn-primary">
                    פתח לטיפול
                  </Link>
                  <Link to={`/view/${f.id}`} className="btn-outline">
                    צפייה
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <PageHeader title="ממתינים לאישור" subtitle="בד״חים הממתינים לחתימת מאשר" />
      {forms === null ? (
        <Spinner />
      ) : forms.length === 0 ? (
        <EmptyState icon="shield-check" title="אין בד״חים הממתינים לאישור" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {forms.map((f) => {
            const s = stats[f.id];
            const isSelf = f.performer_user_id === user.id;
            return (
              <div key={f.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <FormTitle form={f} className="text-[15px] font-bold text-slate-800" />
                    <div className="mt-0.5 text-sm text-slate-500">
                      מבצע: {f.performer_name} · שעה: {formatTimeHM(f.completed_at || f.updated_at || f.created_at)}
                    </div>
                  </div>
                  <span className="badge bg-pending-100 text-pending-700">ממתין</span>
                </div>
                {s && (
                  <div className="mt-3 flex gap-4 text-sm text-slate-600">
                    <span>בדיקות: {s.taskCount}</span>
                    <span className={s.faultCount ? 'text-fault-600 font-semibold' : ''}>
                      תקלות: {s.faultCount}
                    </span>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <Link to={`/form/${f.id}`} className="btn-primary">
                    פתח לאישור
                  </Link>
                  <Link to={`/view/${f.id}`} className="btn-outline">
                    צפייה
                  </Link>
                  {isSelf && (
                    <span className="text-xs text-fault-600">בד״ח שביצעת — נדרש מאשר אחר</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
