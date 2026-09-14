import { useEffect, useState } from 'react';
import {
  createPerformer,
  listPerformers,
  movePerformer,
  setPerformerActive,
  updatePerformer,
} from '@/services/performers';
import { useToast } from '@/context/ToastContext';
import { Modal, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { Performer } from '@/types';

/**
 * Admin screen "ניהול מבצעים": manage the people who can be chosen as מבצע 2.
 * Adding a person makes them available in every new בד״ח; disabling one hides
 * them from NEW forms only — historical documents keep their name snapshot.
 */
export default function PerformersPage() {
  const { notify } = useToast();
  const [performers, setPerformers] = useState<Performer[] | null>(null);
  const [editing, setEditing] = useState<Performer | 'new' | null>(null);

  const load = () => listPerformers(true).then(setPerformers);
  useEffect(() => {
    load();
  }, []);

  const move = async (id: string, dir: 'up' | 'down') => {
    await movePerformer(id, dir);
    load();
  };
  const toggle = async (p: Performer) => {
    if (
      p.active &&
      !confirm(
        `להשבית את "${p.full_name}"? המבצע לא יופיע ברשימת מבצע 2 בבד״חים חדשים. בד״חים קיימים לא ישתנו.`
      )
    )
      return;
    await setPerformerActive(p.id, !p.active);
    load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-ink-900">ניהול מבצעים</h2>
          <p className="text-[13px] text-ink-500">
            רשימת האנשים שיכולים להופיע כ״מבצע 2״ בבד״ח. השבתה מסתירה מבד״חים חדשים בלבד — היסטוריה
            נשמרת.
          </p>
        </div>
        <button className="btn-primary btn-sm gap-1.5" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> הוסף מבצע
        </button>
      </div>

      {performers === null ? (
        <Spinner />
      ) : performers.length === 0 ? (
        <div className="card p-8 text-center text-ink-500">אין מבצעים עדיין.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-16 text-center">סדר</th>
                <th>שם מלא</th>
                <th className="text-center">סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {performers.map((p, i) => (
                <tr key={p.id} className="row-hover">
                  <td className="text-center">
                    <div className="inline-flex gap-1">
                      <button
                        className="btn-ghost !min-h-0 !p-1"
                        onClick={() => move(p.id, 'up')}
                        disabled={i === 0}
                      >
                        <Icon name="up" size={15} />
                      </button>
                      <button
                        className="btn-ghost !min-h-0 !p-1"
                        onClick={() => move(p.id, 'down')}
                        disabled={i === performers.length - 1}
                      >
                        <Icon name="down" size={15} />
                      </button>
                    </div>
                  </td>
                  <td className="font-semibold text-ink-900">{p.full_name}</td>
                  <td className="text-center">
                    {p.active ? (
                      <span className="badge border-ok-200 bg-ok-50 text-ok-700">פעיל</span>
                    ) : (
                      <span className="badge border-slate-200 bg-slate-100 text-slate-500">מושבת</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-3">
                      <button className="link" onClick={() => setEditing(p)}>
                        ערוך
                      </button>
                      <button className="link" onClick={() => toggle(p)}>
                        {p.active ? 'השבת' : 'הפעל'}
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
        <PerformerEditor
          performer={editing === 'new' ? null : editing}
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

function PerformerEditor({
  performer,
  onClose,
  onSaved,
  notify,
}: {
  performer: Performer | null;
  onClose: () => void;
  onSaved: () => void;
  notify: (m: string, k?: 'ok' | 'error' | 'info') => void;
}) {
  const [fullName, setFullName] = useState(performer?.full_name ?? '');
  const [active, setActive] = useState(performer?.active ?? true);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setBusy(true);
    try {
      if (performer) await updatePerformer(performer.id, { full_name: fullName, active });
      else await createPerformer(fullName);
      notify('המבצע נשמר', 'ok');
      onSaved();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={performer ? 'עריכת מבצע' : 'מבצע חדש'} icon="users">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">שם מלא</label>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="לדוגמה: דני כהן"
            autoFocus
          />
        </div>
        {performer && (
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span className="text-[14px] font-medium text-ink-700">
              פעיל (יופיע ברשימת מבצע 2 בבד״חים חדשים)
            </span>
          </label>
        )}
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
