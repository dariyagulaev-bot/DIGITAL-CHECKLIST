import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canPerform } from '@/services/rbac';
import { listTemplates } from '@/services/templates';
import { listSystems } from '@/services/systems';
import { createDraftForm } from '@/services/forms';
import { PageHeader } from '@/components/Layout';
import { EmptyState, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useToast } from '@/context/ToastContext';
import type { System, Template } from '@/types';

export default function NewFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [systems, setSystems] = useState<System[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([listTemplates(false), listSystems(false)])
      .then(([tpls, sys]) => {
        setTemplates(tpls);
        // Only offer systems that actually have at least one published בד״ח.
        const withForms = sys.filter((s) => tpls.some((t) => t.system_id === s.id));
        setSystems(withForms);
        if (withForms.length === 1) setSelectedSystem(withForms[0].id);
      })
      .catch(() => setTemplates([]));
  }, []);

  const systemName = useMemo(() => new Map(systems.map((s) => [s.id, s.name])), [systems]);
  const systemTemplates = useMemo(
    () => (templates ?? []).filter((t) => t.system_id === selectedSystem),
    [templates, selectedSystem]
  );
  const systemFormCount = (sid: string) => (templates ?? []).filter((t) => t.system_id === sid).length;

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

  if (templates === null) return <Spinner label="טוען…" />;

  if (systems.length === 0) {
    return (
      <div>
        <PageHeader title="בד״ח חדש" />
        <EmptyState icon="file" title="אין בד״חים פעילים" hint="פנה למנהל המערכת ליצירת בד״ח" />
      </div>
    );
  }

  // Step 1 — choose a system (only when there is more than one).
  if (!selectedSystem) {
    return (
      <div>
        <PageHeader title="בד״ח חדש" subtitle="בחר מערכת" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {systems.map((s) => (
            <button
              key={s.id}
              className="card group flex items-center gap-3 p-4 text-right transition-colors hover:border-slate-300 hover:bg-slate-50/60"
              onClick={() => setSelectedSystem(s.id)}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-ink-600">
                <Icon name="database" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold text-ink-900">{s.name}</div>
                <div className="text-[13px] text-ink-500">{systemFormCount(s.id)} בד״חים</div>
              </div>
              <Icon name="chevron-start" size={16} className="text-ink-300 group-hover:text-brand-600" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2 — choose a בד״ח within the system.
  return (
    <div>
      <PageHeader
        title="בד״ח חדש"
        subtitle={`מערכת: ${systemName.get(selectedSystem) ?? ''} · בחר בד״ח`}
        actions={
          systems.length > 1 ? (
            <button className="btn-secondary btn-sm gap-1.5" onClick={() => setSelectedSystem(null)}>
              <Icon name="back" size={15} /> החלף מערכת
            </button>
          ) : undefined
        }
      />
      {systemTemplates.length === 0 ? (
        <EmptyState icon="file" title="אין בד״חים פעילים במערכת זו" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {systemTemplates.map((t) => (
            <button
              key={t.id}
              className="card group p-4 text-right transition-colors hover:border-slate-300 hover:bg-slate-50/60 disabled:opacity-60"
              onClick={() => open(t)}
              disabled={busy}
            >
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-ink-600">
                <Icon name="clipboard-check" size={20} />
              </div>
              <div className="text-[15px] font-bold text-ink-900">{t.name}</div>
              {t.description && (
                <div className="mt-0.5 line-clamp-2 text-[13px] text-ink-500">{t.description}</div>
              )}
              <div className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                התחל בדיקה <Icon name="chevron-start" size={15} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
