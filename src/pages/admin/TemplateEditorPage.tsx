import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  addTask,
  deleteTask,
  getTemplate,
  getTemplateTasks,
  moveTask,
  reorderTasks,
  updateTask,
  updateTemplate,
} from '@/services/templates';
import { fileToManagedDataUrl } from '@/services/images';
import { useToast } from '@/context/ToastContext';
import { Modal, Spinner } from '@/components/ui';
import type { Template, TemplateTask } from '@/types';

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { notify } = useToast();
  const [template, setTemplate] = useState<Template | null>(null);
  const [tasks, setTasks] = useState<TemplateTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<TemplateTask | 'new' | null>(null);
  const dragId = useRef<string | null>(null);

  const load = async () => {
    if (!id) return;
    const t = await getTemplate(id);
    setTemplate(t ?? null);
    setTasks(await getTemplateTasks(id));
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <Spinner />;
  if (!template) return <div className="card p-6">התבנית לא נמצאה.</div>;

  const saveMeta = async (patch: Partial<Template>) => {
    await updateTemplate(template.id, patch);
    load();
  };

  const move = async (taskId: string, dir: 'up' | 'down') => {
    await moveTask(taskId, dir);
    load();
  };

  const remove = async (taskId: string) => {
    if (!confirm('למחוק סעיף זה?')) return;
    await deleteTask(taskId);
    load();
  };

  const onDrop = async (targetId: string) => {
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId || sourceId === targetId) return;
    const ids = tasks.map((t) => t.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    await reorderTasks(template.id, ids);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/admin/templates" className="link">
          ← חזרה לתבניות
        </Link>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-slate-700">פרטי התבנית</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">שם</label>
            <input
              className="input"
              defaultValue={template.name}
              onBlur={(e) => e.target.value !== template.name && saveMeta({ name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">תיאור</label>
            <input
              className="input"
              defaultValue={template.description}
              onBlur={(e) =>
                e.target.value !== template.description && saveMeta({ description: e.target.value })
              }
            />
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={template.active}
            onChange={(e) => saveMeta({ active: e.target.checked })}
          />
          <span className="text-sm font-medium text-slate-600">תבנית פעילה</span>
        </label>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-700">בדיקות ({tasks.length})</h2>
          <button className="btn-primary" onClick={() => setEditingTask('new')}>
            ➕ הוסף סעיף
          </button>
        </div>

        <div className="space-y-2">
          {tasks.map((t, i) => (
            <div
              key={t.id}
              draggable
              onDragStart={() => (dragId.current = t.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(t.id)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
            >
              <span className="cursor-grab text-slate-400" title="גרור לשינוי סדר">
                ⠿
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                {i + 1}
              </span>
              {t.image_data && (
                <img
                  src={t.image_data}
                  alt=""
                  className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800">{t.part_name}</div>
                <div className="truncate text-sm text-slate-500">
                  {t.action} · ציוד: {t.equipment || 'ללא'}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="btn-ghost !p-2 text-sm"
                  onClick={() => move(t.id, 'up')}
                  disabled={i === 0}
                >
                  ▲
                </button>
                <button
                  className="btn-ghost !p-2 text-sm"
                  onClick={() => move(t.id, 'down')}
                  disabled={i === tasks.length - 1}
                >
                  ▼
                </button>
                <button className="link" onClick={() => setEditingTask(t)}>
                  ערוך
                </button>
                <button className="link text-fault-700" onClick={() => remove(t.id)}>
                  מחק
                </button>
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="py-8 text-center text-slate-400">אין בדיקות. הוסף סעיף ראשון.</div>
          )}
        </div>
      </section>

      {editingTask && (
        <TaskEditor
          templateId={template.id}
          task={editingTask === 'new' ? null : editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null);
            load();
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

function TaskEditor({
  templateId,
  task,
  onClose,
  onSaved,
  notify,
}: {
  templateId: string;
  task: TemplateTask | null;
  onClose: () => void;
  onSaved: () => void;
  notify: (m: string, k?: 'ok' | 'error' | 'info') => void;
}) {
  const [partName, setPartName] = useState(task?.part_name ?? '');
  const [action, setAction] = useState(task?.action ?? '');
  const [equipment, setEquipment] = useState(task?.equipment ?? '');
  const [image, setImage] = useState<string | null>(task?.image_data ?? null);
  const [busy, setBusy] = useState(false);

  const pickImage = async (file: File | null) => {
    if (!file) return;
    try {
      setImage(await fileToManagedDataUrl(file));
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim() || !action.trim()) {
      notify('יש למלא שם חלק ופעולה', 'error');
      return;
    }
    setBusy(true);
    try {
      if (task) {
        await updateTask(task.id, { part_name: partName, action, equipment, image_data: image });
      } else {
        await addTask(templateId, {
          part_name: partName,
          action,
          equipment,
          image_data: image,
        });
      }
      onSaved();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={task ? 'עריכת סעיף' : 'סעיף חדש'}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">שם החלק</label>
          <input className="input" value={partName} onChange={(e) => setPartName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">הפעולה</label>
          <input className="input" value={action} onChange={(e) => setAction(e.target.value)} />
        </div>
        <div>
          <label className="label">ציוד</label>
          <input className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)} />
        </div>
        <div>
          <label className="label">תמונה (אופציונלי)</label>
          <div className="flex items-center gap-3">
            {image && (
              <img src={image} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
            )}
            <label className="btn-outline cursor-pointer">
              {image ? 'החלף תמונה' : 'בחר תמונה'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
              />
            </label>
            {image && (
              <button type="button" className="btn-ghost text-fault-700" onClick={() => setImage(null)}>
                הסר
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
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
