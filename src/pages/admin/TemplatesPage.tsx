import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplateTasks,
  listTemplates,
  setTemplateActive,
} from '@/services/templates';
import { listSystems } from '@/services/systems';
import { listRanks } from '@/services/ranks';
import { useToast } from '@/context/ToastContext';
import { Modal, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { Rank, System, Template } from '@/types';

export default function TemplatesPage() {
  const { notify } = useToast();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [systems, setSystems] = useState<System[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [systemFilter, setSystemFilter] = useState('ALL');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemId, setSystemId] = useState('');
  const [rankId, setRankId] = useState('');

  const load = async () => {
    const [list, sys, rnk] = await Promise.all([listTemplates(true), listSystems(true), listRanks(true)]);
    setTemplates(list);
    setSystems(sys);
    setRanks(rnk);
    if (!systemId && sys.length) setSystemId(sys.find((s) => s.active)?.id ?? sys[0].id);
    if (!rankId && rnk.length) setRankId(rnk.find((r) => r.active)?.id ?? rnk[0].id);
    const entries = await Promise.all(
      list.map(async (t) => [t.id, (await getTemplateTasks(t.id)).length] as const)
    );
    setCounts(Object.fromEntries(entries));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sysName = useMemo(() => new Map(systems.map((s) => [s.id, s.name])), [systems]);
  const rankName = useMemo(() => new Map(ranks.map((r) => [r.id, r.name])), [ranks]);
  const visible = useMemo(
    () => (templates ?? []).filter((t) => systemFilter === 'ALL' || t.system_id === systemFilter),
    [templates, systemFilter]
  );

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!systemId) {
      notify('יש לבחור מערכת', 'error');
      return;
    }
    await createTemplate({ name, description, system_id: systemId, rank_id: rankId || null });
    notify('הבד״ח נוצר', 'ok');
    setCreating(false);
    setName('');
    setDescription('');
    load();
  };

  const dup = async (id: string) => {
    await duplicateTemplate(id);
    notify('הבד״ח שוכפל', 'ok');
    load();
  };
  const toggle = async (t: Template) => {
    await setTemplateActive(t.id, !t.active);
    load();
  };
  const remove = async (t: Template) => {
    if (!confirm(`למחוק את הבד״ח "${t.name}"? פעולה זו אינה הפיכה.`)) return;
    await deleteTemplate(t.id);
    notify('הבד״ח נמחק', 'ok');
    load();
  };

  const noSystems = systems.length === 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-ink-900">ניהול בד״חים</h2>
          <p className="text-[13px] text-ink-500">יצירה, עריכה ופרסום בד״חים — משויכים למערכת. ללא קוד.</p>
        </div>
        <div className="flex items-center gap-2">
          {systems.length > 1 && (
            <select
              className="input !min-h-[36px] !py-1.5 text-[13px]"
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
            >
              <option value="ALL">כל המערכות</option>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn-primary btn-sm gap-1.5"
            onClick={() => setCreating(true)}
            disabled={noSystems}
            title={noSystems ? 'יש ליצור מערכת תחילה' : undefined}
          >
            <Icon name="plus" size={16} /> בד״ח חדש
          </button>
        </div>
      </div>

      {noSystems && (
        <div className="card mb-4 border-r-2 border-r-pending-500 p-4 text-[13.5px] text-ink-600">
          כדי ליצור בד״ח יש קודם ליצור מערכת ב
          <Link to="/admin/systems" className="link mx-1">
            ניהול מערכות
          </Link>
          .
        </div>
      )}

      {templates === null ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <div className="card p-8 text-center text-ink-500">אין בד״חים להצגה.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((t) => (
            <div key={t.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] font-semibold text-brand-700">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="database" size={12} /> {sysName.get(t.system_id) ?? 'ללא מערכת'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-ink-400">
                      <Icon name="layers" size={12} /> {t.rank_id ? rankName.get(t.rank_id) ?? '—' : 'כל הדרגים'}
                    </span>
                  </div>
                  <div className="text-[15px] font-bold text-ink-900">{t.name}</div>
                  <div className="text-[13px] text-ink-500">{t.description || '—'}</div>
                  <div className="mt-1 text-[12px] text-ink-400">{counts[t.id] ?? 0} שורות</div>
                </div>
                {t.active ? (
                  <span className="badge border-ok-200 bg-ok-50 text-ok-700">מפורסם</span>
                ) : (
                  <span className="badge border-slate-200 bg-slate-100 text-slate-500">טיוטה</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-[13px]">
                <Link to={`/admin/templates/${t.id}`} className="link">
                  עריכה
                </Link>
                <button className="link" onClick={() => dup(t.id)}>
                  שכפל
                </button>
                <button className="link" onClick={() => toggle(t)}>
                  {t.active ? 'בטל פרסום' : 'פרסם'}
                </button>
                <button className="text-fault-600 hover:underline" onClick={() => remove(t)}>
                  מחק
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="בד״ח חדש" icon="file">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">סוג מערכת</label>
              <select className="input" value={systemId} onChange={(e) => setSystemId(e.target.value)}>
                {systems
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">דרג בדיקה</label>
              <select className="input" value={rankId} onChange={(e) => setRankId(e.target.value)}>
                <option value="">כל הדרגים</option>
                {ranks
                  .filter((r) => r.active)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">שם הבד״ח</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: בד״ח יומי / בדיקת מערכת לפני הפעלה"
              autoFocus
            />
          </div>
          <div>
            <label className="label">תיאור (אופציונלי)</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1">
              צור בד״ח
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
