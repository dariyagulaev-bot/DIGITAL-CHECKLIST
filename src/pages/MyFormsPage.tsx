import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  getUserSummary,
  isEditableByPerformer,
  listFormsByPerformer,
  listInTreatment,
  type UserFormSummary,
} from '@/services/forms';
import { isUserCertified } from '@/services/certifications';
import { isAdmin } from '@/services/rbac';
import { PageHeader } from '@/components/Layout';
import { EmptyState, Spinner, StatusBadge } from '@/components/ui';
import { FormTitle } from '@/components/FormTitle';
import { formatTimeHM, formatStamp } from '@/exports/labels';
import { Icon } from '@/components/Icon';
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
  const [treatment, setTreatment] = useState<CompletedForm[]>([]);

  useEffect(() => {
    if (!user) return;
    listFormsByPerformer(user.id).then(setForms).catch(() => setForms([]));
    getUserSummary(user.id).then(setSummary).catch(() => {});
    // Treatment inbox — IN_TREATMENT forms this user is certified to treat.
    listInTreatment()
      .then(async (list) => {
        if (isAdmin(user)) return setTreatment(list);
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
              <Link
                key={f.id}
                to={`/form/${f.id}`}
                className="card border-r-2 border-r-pending-500 p-4 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <FormTitle form={f} className="font-semibold text-slate-800" />
                    <div className="mt-0.5 text-sm text-slate-500">
                      הועבר ע״י {f.transferred_by_name || '—'} · {formatStamp(f.transferred_at)}
                    </div>
                  </div>
                  <span className="badge bg-pending-100 text-pending-700">
                    <Icon name="shield-check" size={12} /> {f.treatment_rank_name || 'דרג מטפל'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
                <FormTitle form={f} className="font-semibold text-slate-800" />
                <div className="mt-0.5 text-sm text-slate-500">
                  {f.number ? `מס' ${f.number} · ` : ''}
                  שעה: {formatTimeHM((isEditableByPerformer(f) ? f.updated_at : f.completed_at) ?? f.updated_at ?? f.date)}
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
