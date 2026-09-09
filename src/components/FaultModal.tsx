import { useEffect, useState } from 'react';
import { Modal } from './ui';
import { Icon } from './Icon';
import { fileToManagedDataUrl } from '@/services/images';
import type { CompletedTask } from '@/types';

/**
 * Fault-detail popup ("קוביית פירוט אי-תקינות").
 * Opens only when a row is marked "לא תקין". Captures the free-text detail
 * ("מה בדיוק לא תקין?") plus an optional photo, and saves them onto the row —
 * there is no permanent notes column in the table.
 */
export function FaultModal({
  open,
  task,
  editable,
  onClose,
  onSaveDetail,
  onSetImage,
  onViewImage,
  notifyError,
}: {
  open: boolean;
  task: CompletedTask | null;
  editable: boolean;
  onClose: () => void;
  onSaveDetail: (text: string) => Promise<void> | void;
  onSetImage: (file: File | null) => Promise<void> | void;
  onViewImage: (src: string) => void;
  notifyError: (msg: string) => void;
}) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sync local state whenever a different task's modal is opened.
  useEffect(() => {
    if (open && task) {
      setText(task.comment ?? '');
      setPreview(task.fault_image ?? null);
    }
  }, [open, task]);

  if (!task) return null;

  const pickImage = async (file: File | null) => {
    if (!file) return;
    try {
      const data = await fileToManagedDataUrl(file);
      setPreview(data);
      await onSetImage(file); // persist immediately
    } catch (e) {
      notifyError((e as Error).message);
    }
  };

  const removeImage = async () => {
    setPreview(null);
    await onSetImage(null);
  };

  const save = async () => {
    setBusy(true);
    try {
      await onSaveDetail(text.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="פירוט אי-תקינות" tone="fault" icon="alert">
      <div className="space-y-4">
        <div className="rounded-xl border border-fault-100 bg-fault-50 px-4 py-2.5 text-sm font-semibold text-fault-700">
          {task.part_name_snapshot} · {task.action_snapshot}
        </div>

        <div>
          <label className="label text-fault-700">מה בדיוק לא תקין?</label>
          <textarea
            className="input min-h-[110px]"
            value={text}
            disabled={!editable}
            onChange={(e) => setText(e.target.value)}
            placeholder="תאר את התקלה שנמצאה…"
            autoFocus
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {preview && (
            <button type="button" onClick={() => onViewImage(preview)}>
              <img
                src={preview}
                alt="תמונת תקלה"
                className="h-20 w-20 rounded-lg border border-fault-200 object-cover"
              />
            </button>
          )}
          {editable && (
            <label className="btn-outline btn-sm cursor-pointer gap-1.5">
              <Icon name="camera" size={16} /> {preview ? 'החלף תמונה' : 'צרף תמונה'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
          {editable && preview && (
            <button type="button" className="btn-danger btn-sm gap-1.5" onClick={removeImage}>
              <Icon name="trash" size={16} /> הסר
            </button>
          )}
        </div>

        {editable ? (
          <div className="flex gap-3 pt-1">
            <button className="btn-fault flex-1" onClick={save} disabled={busy}>
              <Icon name="check" size={18} /> שמור
            </button>
            <button className="btn-ghost" onClick={onClose} disabled={busy}>
              ביטול
            </button>
          </div>
        ) : (
          <button className="btn-ghost w-full" onClick={onClose}>
            סגור
          </button>
        )}
      </div>
    </Modal>
  );
}
