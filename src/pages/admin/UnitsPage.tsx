import { useEffect, useMemo, useState } from 'react';
import { createUnit, listUnits, updateUnit } from '@/services/units';
import { listSystems } from '@/services/systems';
import { useToast } from '@/context/ToastContext';
import { Modal, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { System, Unit } from '@/types';

export default function UnitsPage() {
  const { notify } = useToast();
  const [systems, setSystems] = useState<System[]>([]);
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [selected, setSelected] = useState('');
  const [editing, setEditing] = useState<Unit | 'new' | null>(null);

  const load = async () => {
    const [sys, u] = await Promise.all([listSystems(true), listUnits(true)]);
    setSystems(sys);
    setUnits(u);
    if (!selected && sys.length) setSelected(sys[0].id);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(
    () => (units ?? []).filter((u) => u.system_id === selected),
    [units, selected]
  );

  const toggle = async (u: Unit) => {
    if (u.active && !confirm(`להשבית את היחידה "${u.name}"?`)) return;
    await updateUnit(u.id, { active: !u.active });
    load();
  };

  const noSystems = systems.length === 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-ink-900">יחידות</h2>
          <p className="text-[13px] text-ink-500">כל יחידה שייכת לסוג מערכת. הכמות אינה קבועה.</p>
        </div>
        <div className="flex items-center gap-2">
          {systems.length > 0 && (
            <select
              className="input !min-h-[36px] !py-1.5 text-[13px]"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.active ? '' : ' (מושבת)'}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn-primary btn-sm gap-1.5"
            onClick={() => setEditing('new')}
            disabled={noSystems}
          >
            <Icon name="plus" size={16} /> יחידה חדשה
          </button>
        </div>
      </div>

      {units === null ? (
        <Spinner />
      ) : noSystems ? (
        <div className="card p-8 text-center text-ink-500">יש ליצור קודם סוג מערכת.</div>
      ) : visible.length === 0 ? (
        <div className="card p-8 text-center text-ink-500">אין יחידות בסוג מערכת זה.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>שם / מספר יחידה</th>
                <th className="text-center">סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} className="row-hover">
                  <td className="font-semibold text-ink-900">{u.name}</td>
                  <td className="text-center">
                    {u.active ? (
                      <span className="badge border-ok-200 bg-ok-50 text-ok-700">פעילה</span>
                    ) : (
                      <span className="badge border-slate-200 bg-slate-100 text-slate-500">מושבתת</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-3">
                      <button className="link" onClick={() => setEditing(u)}>
                        עריכה
                      </button>
                      <button className="link" onClick={() => toggle(u)}>
                        {u.active ? 'השבת' : 'הפעל'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <UnitEditor
          unit={editing === 'new' ? null : editing}
          systems={systems}
          defaultSystem={selected}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

function UnitEditor({
  unit,
  systems,
  defaultSystem,
  onClose,
  onSaved,
  notify,
}: {
  unit: Unit | null;
  systems: System[];
  defaultSystem: string;
  onClose: () => void;
  onSaved: () => void;
  notify: (m: string, k?: 'ok' | 'error' | 'info') => void;
}) {
  const [name, setName] = useState(unit?.name ?? '');
  const [systemId, setSystemId] = useState(unit?.system_id ?? defaultSystem);
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (unit) await updateUnit(unit.id, { name, system_id: systemId });
      else await createUnit(systemId, name);
      notify('היחידה נשמרה', 'ok');
      onSaved();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={unit ? 'עריכת יחידה' : 'יחידה חדשה'} icon="layers">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">סוג מערכת</label>
          <select className="input" value={systemId} onChange={(e) => setSystemId(e.target.value)}>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">שם / מספר יחידה</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמה: A-03"
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
