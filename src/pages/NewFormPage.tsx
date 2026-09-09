import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canPerform } from '@/services/rbac';
import { listTemplates } from '@/services/templates';
import { createDraftForm } from '@/services/forms';
import { PageHeader } from '@/components/Layout';
import { EmptyState, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
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
    return <EmptyState icon="lock" title="אין לך הרשאת ביצוע בד״חים" />;
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
          icon="file"
          title="אין בד״חים פעילים"
          hint="פנה למנהל המערכת ליצירת בד״ח"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.id}
              className="card hoverable group p-5 text-right disabled:opacity-60"
              onClick={() => open(t)}
              disabled={busy}
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-transform group-hover:scale-105">
                <Icon name="clipboard-check" size={24} />
              </div>
              <div className="text-[17px] font-extrabold text-ink-900">{t.name}</div>
              {t.description && (
                <div className="mt-1 line-clamp-2 text-sm text-slate-500">{t.description}</div>
              )}
              <div className="mt-4 flex items-center gap-1 text-sm font-bold text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                התחל בדיקה <Icon name="chevron-start" size={16} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
