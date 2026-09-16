import { useEffect, useState } from 'react';
import { Modal } from './ui';
import { Icon } from './Icon';
import { fileToManagedDataUrl } from '@/services/images';
import type { CompletedTask } from '@/types';

/**
 * "דיווח על ביצוע תיקון" — opens for a section the approver returned for fix.
 * Shows the ORIGINAL fault and the approver's note first (read-only), then lets
 * the performer document whether it was fixed and exactly what was done. The
 * reporter, date and time are captured automatically by the service.
 */
export function RepairModal({
  open,
  task,
  onClose,
  onSubmit,
  onViewImage,
  notifyError,
}: {
  open: boolean;
  task: CompletedTask | null;
  onClose: () => void;
  onSubmit: (r: { done: boolean; description: string; image: string | null }) => Promise<void>;
  onViewImage: (src: string) => void;
  notifyError: (msg: string) => void;
}) {
  const [done, setDone] = useState<boolean | null>(null);
  const [desc, setDesc] = useState('');
  const [after, setAfter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && task) {
      setDone(task.repair_reported ? task.repair_done ?? null : null);
      setDesc(task.repair_description ?? '');
      setAfter(task.repair_image ?? null);
    }
  }, [open, task]);

  if (!task) return null;

  const pick = async (f: File | null) => {
    if (!f) return;
    try {
      setAfter(await fileToManagedDataUrl(f));
    } catch (e) {
      notifyError((e as Error).message);
    }
  };

  const submit = async () => {
    if (done === null) return notifyError('יש לבחור האם התקלה תוקנה.');
    if (done && !desc.trim()) return notifyError('יש לפרט מה בוצע בתיקון.');
    setBusy(true);
    try {
      await onSubmit({ done, description: desc.trim(), image: after });
      onClose();
    } catch (e) {
      notifyError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="דיווח על ביצוע תיקון" tone="primary" icon="clipboard-check">
      <div className="space-y-4">
        {/* Original fault + approver note (read-only context) */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-semibold text-ink-800">
            {task.part_name_snapshot} · {task.action_snapshot}
          </div>
          <div className="mt-1 text-[13px] text-ink-600">
            <span className="font-semibold text-fault-700">התקלה המקורית: </span>
            {task.comment?.trim() || '—'}
          </div>
          {task.fault_image && (
            <button type="button" className="mt-2" onClick={() => onViewImage(task.fault_image!)}>
              <img src={task.fault_image} alt="תמונת תקלה" className="h-16 w-16 rounded border border-slate-200 object-cover" />
            </button>
          )}
          {task.return_note && (
            <div className="mt-2 rounded-md border border-pending-200 bg-pending-50 px-3 py-2 text-[13px] text-ink-800">
              <span className="font-semibold text-pending-700">הערת המאשר: </span>
              {task.return_note}
            </div>
          )}
        </div>

        {/* Was it fixed? */}
        <div>
          <label className="label">האם התקלה תוקנה?</label>
          <div className="flex gap-3">
            {[
              { v: true, t: 'כן' },
              { v: false, t: 'לא' },
            ].map((o) => (
              <button
                key={o.t}
                type="button"
                onClick={() => setDone(o.v)}
                className={`flex-1 rounded-md border px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                  done === o.v
                    ? o.v
                      ? 'border-ok-500 bg-ok-50 text-ok-700'
                      : 'border-fault-500 bg-fault-50 text-fault-700'
                    : 'border-slate-300 bg-white text-ink-600 hover:border-slate-400'
                }`}
              >
                {o.t}
              </button>
            ))}
          </div>
        </div>

        {done === true && (
          <div>
            <label className="label">מה בוצע בתיקון?</label>
            <textarea
              className="input min-h-[100px]"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="לדוגמה: הוחלף המחבר הפגום, החיבור חוזק ובוצעה בדיקה חוזרת."
              autoFocus
            />
          </div>
        )}

        {done !== null && (
          <div className="flex flex-wrap items-center gap-3">
            {after && (
              <button type="button" onClick={() => onViewImage(after)}>
                <img src={after} alt="תמונה לאחר תיקון" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
              </button>
            )}
            <label className="btn-secondary btn-sm cursor-pointer gap-1.5">
              <Icon name="camera" size={16} /> {after ? 'החלף תמונה' : 'תמונה לאחר תיקון (אופציונלי)'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
            </label>
            {after && (
              <button type="button" className="btn-danger btn-sm gap-1.5" onClick={() => setAfter(null)}>
                <Icon name="trash" size={16} /> הסר
              </button>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button className="btn-primary flex-1" onClick={submit} disabled={busy || done === null}>
            <Icon name="check" size={18} /> שמור דיווח
          </button>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            ביטול
          </button>
        </div>
      </div>
    </Modal>
  );
}
