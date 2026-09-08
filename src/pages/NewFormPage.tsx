import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canPerform } from '@/services/rbac';
import { listTemplates } from '@/services/templates';
import { createDraftForm } from '@/services/forms';
import { PageHeader } from '@/components/Layout';
import { EmptyState, Spinner } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import type { Template } from '@/types';

export default function NewFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listTemplates(false).then(setTemplates).catch(() => setTemplates([]));
  }, []);

  if (!user || !canPerform(user)) {
    return <EmptyState icon="🔒" title="אין לך הרשאת ביצוע בד״חים" />;
  }

  const open = async (t: Template) => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await createDraftForm({ templateId: t.id, performer: user });
      navigate(`/form/${id}`);
    } catch (e) {
      notify((e as Error).message, 'error');
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="בד״ח חדש" subtitle="בחר בד״ח כדי להתחיל" />
      {templates === null ? (
        <Spinner label="טוען בד״חים…" />
      ) : templates.length === 0 ? (
        <EmptyState
          icon="📄"
          title="אין בד״חים פעילים"
          hint="פנה למנהל המערכת ליצירת בד״ח"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.id}
              className="card p-6 text-right transition-shadow hover:shadow-soft disabled:opacity-60"
              onClick={() => open(t)}
              disabled={busy}
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-2xl text-brand-700">
                📝
              </div>
              <div className="text-lg font-bold text-slate-800">{t.name}</div>
              {t.description && (
                <div className="mt-1 text-sm text-slate-500 line-clamp-2">{t.description}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
