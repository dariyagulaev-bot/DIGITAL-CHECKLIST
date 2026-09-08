import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getFormStats, listPendingApproval } from '@/services/forms';
import { PageHeader } from '@/components/Layout';
import { EmptyState, Spinner } from '@/components/ui';
import { formatDate } from '@/exports/labels';
import type { CompletedForm } from '@/types';

export default function PendingPage() {
  const { user } = useAuth();
  const [forms, setForms] = useState<CompletedForm[] | null>(null);
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

  if (!user) return null;

  return (
    <div>
      <PageHeader title="ממתינים לאישור" subtitle="בד״חים הממתינים לחתימת מאשר" />
      {forms === null ? (
        <Spinner />
      ) : forms.length === 0 ? (
        <EmptyState icon="✅" title="אין בד״חים הממתינים לאישור" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {forms.map((f) => {
            const s = stats[f.id];
            const isSelf = f.performer_user_id === user.id;
            return (
              <div key={f.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-slate-800">{f.name}</div>
                    <div className="text-sm text-slate-500">
                      מבצע: {f.performer_name} · {formatDate(f.date)}
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
