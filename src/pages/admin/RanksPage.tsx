import { useEffect, useState } from 'react';
import { createRank, listRanks, moveRank, updateRank } from '@/services/ranks';
import { useToast } from '@/context/ToastContext';
import { Modal, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { Rank } from '@/types';

export default function RanksPage() {
  const { notify } = useToast();
  const [ranks, setRanks] = useState<Rank[] | null>(null);
  const [editing, setEditing] = useState<Rank | 'new' | null>(null);

  const load = () => listRanks(true).then(setRanks);
  useEffect(() => {
    load();
  }, []);

  const move = async (id: string, dir: 'up' | 'down') => {
    await moveRank(id, dir);
    load();
  };
  const toggle = async (r: Rank) => {
    if (r.active && !confirm(`להשבית את "${r.name}"? דרג מושבת לא יוצג במסך בדיקה חדשה.`)) return;
    await updateRank(r.id, { active: !r.active });
    load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-ink-900">דרגי בדיקה</h2>
          <p className="text-[13px] text-ink-500">רשימה דינמית וניתנת לסידור. לדוגמה: דרג א׳ / ב׳ / ד׳.</p>
        </div>
        <button className="btn-primary btn-sm gap-1.5" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> דרג חדש
        </button>
      </div>

      {ranks === null ? (
        <Spinner />
      ) : ranks.length === 0 ? (
        <div className="card p-8 text-center text-ink-500">אין דרגים עדיין.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-16 text-center">סדר</th>
                <th>שם הדרג</th>
                <th className="text-center">סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {ranks.map((r, i) => (
                <tr key={r.id} className="row-hover">
                  <td className="text-center">
                    <div className="inline-flex gap-1">
                      <button className="btn-ghost !min-h-0 !p-1" onClick={() => move(r.id, 'up')} disabled={i === 0}>
                        <Icon name="up" size={15} />
                      </button>
                      <button
                        className="btn-ghost !min-h-0 !p-1"
                        onClick={() => move(r.id, 'down')}
                        disabled={i === ranks.length - 1}
                      >
                        <Icon name="down" size={15} />
                      </button>
                    </div>
                  </td>
                  <td className="font-semibold text-ink-900">{r.name}</td>
                  <td className="text-center">
                    {r.active ? (
                      <span className="badge border-ok-200 bg-ok-50 text-ok-700">פעיל</span>
                    ) : (
                      <span className="badge border-slate-200 bg-slate-100 text-slate-500">מושבת</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-3">
                      <button className="link" onClick={() => setEditing(r)}>
                        שנה שם
                      </button>
                      <button className="link" onClick={() => toggle(r)}>
                        {r.active ? 'השבת' : 'הפעל'}
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
        <RankEditor
          rank={editing === 'new' ? null : editing}
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

function RankEditor({
  rank,
  onClose,
  onSaved,
  notify,
}: {
  rank: Rank | null;
  onClose: () => void;
  onSaved: () => void;
  notify: (m: string, k?: 'ok' | 'error' | 'info') => void;
}) {
  const [name, setName] = useState(rank?.name ?? '');
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (rank) await updateRank(rank.id, { name });
      else await createRank(name);
      notify('הדרג נשמר', 'ok');
      onSaved();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={rank ? 'עריכת דרג' : 'דרג חדש'} icon="shield-check">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">שם הדרג</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמה: דרג א׳"
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
