import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplateTasks,
  listTemplates,
  setTemplateActive,
} from '@/services/templates';
import { useToast } from '@/context/ToastContext';
import { Modal, Spinner } from '@/components/ui';
import type { Template } from '@/types';

export default function TemplatesPage() {
  const { notify } = useToast();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = async () => {
    const list = await listTemplates(true);
    setTemplates(list);
    const entries = await Promise.all(
      list.map(async (t) => [t.id, (await getTemplateTasks(t.id)).length] as const)
    );
    setCounts(Object.fromEntries(entries));
  };
  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createTemplate({ name, description });
    notify('התבנית נוצרה', 'ok');
    setCreating(false);
    setName('');
    setDescription('');
    load();
  };

  const dup = async (id: string) => {
    await duplicateTemplate(id);
    notify('התבנית שוכפלה', 'ok');
    load();
  };

  const toggle = async (t: Template) => {
    await setTemplateActive(t.id, !t.active);
    load();
  };

  const remove = async (t: Template) => {
    if (!confirm(`למחוק את התבנית "${t.name}"? פעולה זו אינה הפיכה.`)) return;
    await deleteTemplate(t.id);
    notify('התבנית נמחקה', 'ok');
    load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-700">ניהול תבניות</h2>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          ➕ תבנית חדשה
        </button>
      </div>

      {templates === null ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-bold text-slate-800">{t.name}</div>
                  <div className="text-sm text-slate-500">{t.description || '—'}</div>
                  <div className="mt-1 text-xs text-slate-400">{counts[t.id] ?? 0} בדיקות</div>
                </div>
                {t.active ? (
                  <span className="badge bg-ok-100 text-ok-700">פעילה</span>
                ) : (
                  <span className="badge bg-slate-100 text-slate-500">מושבתת</span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/admin/templates/${t.id}`} className="btn-outline !py-2 text-sm">
                  ✏️ עריכה
                </Link>
                <button className="btn-ghost !py-2 text-sm" onClick={() => dup(t.id)}>
                  שכפל
                </button>
                <button className="btn-ghost !py-2 text-sm" onClick={() => toggle(t)}>
                  {t.active ? 'השבת' : 'הפעל'}
                </button>
                <button
                  className="btn-ghost !py-2 text-sm text-fault-700"
                  onClick={() => remove(t)}
                >
                  מחק
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="תבנית חדשה">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="label">שם התבנית</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">תיאור (אופציונלי)</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1">
              צור תבנית
            </button>
            <button type="button" className="btn-ghost" onClick={() => setCreating(false)}>
              ביטול
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
