import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  getUserSummary,
  isEditableByPerformer,
  listFormsByPerformer,
  type UserFormSummary,
} from '@/services/forms';
import { PageHeader } from '@/components/Layout';
import { EmptyState, Spinner, StatusBadge } from '@/components/ui';
import { formatDate } from '@/exports/labels';
import type { CompletedForm } from '@/types';

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card p-4 text-center">
      <div className={`text-3xl font-bold ${accent}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

export default function MyFormsPage() {
  const { user } = useAuth();
  const [forms, setForms] = useState<CompletedForm[] | null>(null);
  const [summary, setSummary] = useState<UserFormSummary | null>(null);

  useEffect(() => {
    if (!user) return;
    listFormsByPerformer(user.id).then(setForms).catch(() => setForms([]));
    getUserSummary(user.id).then(setSummary).catch(() => {});
  }, [user]);

  if (!user) return null;

  return (
    <div>
      <PageHeader title="הבד״חים שלי" subtitle="כל הבד״חים שביצעת" />

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="סה״כ" value={summary.total} accent="text-slate-700" />
          <StatCard label="מאושרים" value={summary.approved} accent="text-ok-600" />
          <StatCard label="ממתינים" value={summary.pending} accent="text-pending-600" />
          <StatCard label="עם תקלות" value={summary.withFaults} accent="text-fault-600" />
        </div>
      )}

      {forms === null ? (
        <Spinner />
      ) : forms.length === 0 ? (
        <EmptyState icon="clipboard-check" title="עדיין לא ביצעת בד״חים" hint="התחל מ״בד״ח חדש״" />
      ) : (
        <div className="card divide-y divide-slate-100">
          {forms.map((f) => (
            <Link
              key={f.id}
              to={isEditableByPerformer(f) ? `/form/${f.id}` : `/view/${f.id}`}
              className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="font-semibold text-slate-800">{f.name}</div>
                <div className="text-sm text-slate-500">
                  {f.number ? `מס' ${f.number} · ` : ''}
                  {formatDate(f.date)}
                </div>
              </div>
              <StatusBadge status={f.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
