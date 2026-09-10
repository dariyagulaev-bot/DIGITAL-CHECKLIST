import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  countTemplatesInSystem,
  createSystem,
  listSystems,
  moveSystem,
  setSystemActive,
  updateSystem,
} from '@/services/systems';
import { useAuth } from '@/context/AuthContext';
import { logAudit } from '@/services/audit';
import { useToast } from '@/context/ToastContext';
import { Modal, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { System } from '@/types';

export default function SystemsPage() {
  const { user: admin } = useAuth();
  const { notify } = useToast();
  const [systems, setSystems] = useState<System[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<System | 'new' | null>(null);

  const load = async () => {
    const list = await listSystems(true);
    setSystems(list);
    const entries = await Promise.all(
      list.map(async (s) => [s.id, await countTemplatesInSystem(s.id)] as const)
    );
    setCounts(Object.fromEntries(entries));
  };
  useEffect(() => {
    load();
  }, []);

  const toggle = async (s: System) => {
    if (s.active && !confirm(`להשבית את סוג המערכת "${s.name}"? לא יוצג במסך בדיקה חדשה.`)) return;
    await setSystemActive(s.id, !s.active);
    if (admin)
      await logAudit({
        user_id: admin.id,
        user_name: admin.full_name,
        action: s.active ? 'DISABLE_SYSTEM' : 'ENABLE_SYSTEM',
        entity_type: 'system',
        entity_id: s.id,
      });
    notify('סטטוס המערכת עודכן', 'ok');
    load();
  };

  const move = async (id: string, dir: 'up' | 'down') => {
    await moveSystem(id, dir);
    load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-ink-900">סוגי מערכת</h2>
          <p className="text-[13px] text-ink-500">הרמה העליונה בהיררכיה. לכל סוג מערכת שייכות יחידות ובד״חים.</p>
        </div>
        <button className="btn-primary btn-sm gap-1.5" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> סוג מערכת חדש
        </button>
      </div>

      {systems === null ? (
        <Spinner />
      ) : systems.length === 0 ? (
        <div className="card p-8 text-center text-ink-500">
          אין מערכות עדיין. צור מערכת ראשונה כדי לשייך אליה בד״חים.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-16 text-center">סדר</th>
                <th>שם סוג המערכת</th>
                <th className="text-center">בד״חים</th>
                <th className="text-center">סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {systems.map((s, i) => (
                <tr key={s.id} className="row-hover">
                  <td className="text-center">
                    <div className="inline-flex gap-1">
                      <button className="btn-ghost !min-h-0 !p-1" onClick={() => move(s.id, 'up')} disabled={i === 0}>
                        <Icon name="up" size={15} />
                      </button>
                      <button
                        className="btn-ghost !min-h-0 !p-1"
                        onClick={() => move(s.id, 'down')}
                        disabled={i === systems.length - 1}
                      >
                        <Icon name="down" size={15} />
                      </button>
                    </div>
                  </td>
                  <td className="font-semibold text-ink-900">{s.name}</td>
                  <td className="nums text-center">{counts[s.id] ?? 0}</td>
                  <td className="text-center">
                    {s.active ? (
                      <span className="badge border-ok-200 bg-ok-50 text-ok-700">פעיל</span>
                    ) : (
                      <span className="badge border-slate-200 bg-slate-100 text-slate-500">מושבת</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <button className="link" onClick={() => setEditing(s)}>
                        שנה שם
                      </button>
                      <button className="link" onClick={() => toggle(s)}>
                        {s.active ? 'השבת' : 'הפעל'}
                      </button>
                      <Link to="/admin/units" className="link">
                        יחידות
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <SystemEditor
          system={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          adminId={admin?.id}
          adminName={admin?.full_name}
        />
      )}
    </div>
  );
}

function SystemEditor({
  system,
  onClose,
  onSaved,
  adminId,
  adminName,
}: {
  system: System | null;
  onClose: () => void;
  onSaved: () => void;
  adminId?: string;
  adminName?: string;
}) {
  const { notify } = useToast();
  const [name, setName] = useState(system?.name ?? '');
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      notify('יש להזין שם מערכת', 'error');
      return;
    }
    setBusy(true);
    try {
      if (system) await updateSystem(system.id, { name });
      else await createSystem(name);
      if (adminId && adminName)
        await logAudit({
          user_id: adminId,
          user_name: adminName,
          action: system ? 'RENAME_SYSTEM' : 'CREATE_SYSTEM',
          entity_type: 'system',
          entity_id: system?.id ?? name,
          new_value: name.trim(),
        });
      notify('המערכת נשמרה', 'ok');
      onSaved();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={system ? 'עריכת מערכת' : 'מערכת חדשה'} icon="database">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">שם המערכת</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמה: מערכת א׳"
            autoFocus
          />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex-1" disabled={busy}>
            שמור
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            ביטול
          </button>
        </div>
      </form>
    </Modal>
  );
}
