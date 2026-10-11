import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getTemplate,
  getTemplateTasks,
  updateTask,
  updateTemplate,
} from '@/services/templates';
import {
  addBlock,
  addCheckBlock,
  deleteBlock,
  duplicateBlock,
  ensureBlocks,
  getTemplateBlocks,
  moveBlock,
  reorderBlocks,
  updateBlockConfig,
  checkTaskId,
} from '@/services/blocks';
import { fileToManagedDataUrl } from '@/services/images';
import { listSystems } from '@/services/systems';
import { listRanks } from '@/services/ranks';
import { useToast } from '@/context/ToastContext';
import { Modal, Spinner } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { equipmentItemsOf } from '@/exports/labels';
import { TableBlockEditor } from './TableBlockEditor';
import type {
  BlockType,
  EquipmentConfig,
  ImageConfig,
  Rank,
  SectionConfig,
  System,
  TableConfig,
  Template,
  TemplateBlock,
  TemplateTask,
  TextConfig,
} from '@/types';

/** Block-type presentation (label + icon) for the add menu and the list. */
const BLOCK_META: Record<BlockType, { label: string; icon: IconName }> = {
  check: { label: 'סעיף בדיקה', icon: 'clipboard-check' },
  section: { label: 'כותרת / Section', icon: 'file' },
  text: { label: 'טקסט / הוראה', icon: 'pen' },
  table: { label: 'טבלת מדידה', icon: 'layers' },
  image: { label: 'תמונה', icon: 'image' },
  equipment: { label: 'ציוד נדרש', icon: 'settings' },
  divider: { label: 'מפריד', icon: 'grip' },
};
const ADDABLE: BlockType[] = ['check', 'section', 'text', 'table', 'image', 'equipment', 'divider'];

type Editing =
  | { kind: 'new-check' }
  | { kind: 'block'; block: TemplateBlock }
  | null;

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { notify } = useToast();
  const [template, setTemplate] = useState<Template | null>(null);
  const [blocks, setBlocks] = useState<TemplateBlock[]>([]);
  const [tasks, setTasks] = useState<Map<string, TemplateTask>>(new Map());
  const [systems, setSystems] = useState<System[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  const load = async () => {
    if (!id) return;
    const t = await getTemplate(id);
    setTemplate(t ?? null);
    if (t) await ensureBlocks(t.id);
    const [blks, taskList, sys, rnk] = await Promise.all([
      getTemplateBlocks(id),
      getTemplateTasks(id),
      listSystems(true),
      listRanks(true),
    ]);
    setBlocks(blks);
    setTasks(new Map(taskList.map((x) => [x.id, x])));
    setSystems(sys);
    setRanks(rnk);
    setLoading(false);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <Spinner />;
  if (!template) return <div className="card p-6">הבד״ח לא נמצא.</div>;

  const saveMeta = async (patch: Partial<Template>) => {
    await updateTemplate(template.id, patch);
    load();
  };
  const move = async (blockId: string, dir: 'up' | 'down') => {
    await moveBlock(blockId, dir);
    load();
  };
  const remove = async (block: TemplateBlock) => {
    if (!confirm('למחוק רכיב זה?')) return;
    await deleteBlock(block.id);
    load();
  };
  const duplicate = async (block: TemplateBlock) => {
    await duplicateBlock(block.id);
    notify('הרכיב שוכפל', 'ok');
    load();
  };
  const onDrop = async (targetId: string) => {
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId || sourceId === targetId) return;
    const ids = blocks.map((b) => b.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    await reorderBlocks(template.id, ids);
    load();
  };

  const pickType = async (type: BlockType) => {
    setAddOpen(false);
    if (type === 'check') {
      setEditing({ kind: 'new-check' });
      return;
    }
    const block = await addBlock(template.id, type);
    await load();
    if (type !== 'divider') setEditing({ kind: 'block', block });
  };

  // Running number for check blocks (display only — never a DB id).
  let checkNo = 0;

  return (
    <div className="space-y-6">
      {/* Template meta */}
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-700">פרטי הבד״ח</h2>
          <span className="badge border-brand-200 bg-brand-50 text-brand-700">גרסה {template.version}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">סוג מערכת</label>
            <select className="input" value={template.system_id} onChange={(e) => saveMeta({ system_id: e.target.value })}>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.active ? '' : ' (מושבתת)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">דרג בדיקה</label>
            <select className="input" value={template.rank_id ?? ''} onChange={(e) => saveMeta({ rank_id: e.target.value || null })}>
              <option value="">כל הדרגים</option>
              {ranks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.active ? '' : ' (מושבת)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">שם הבד״ח</label>
            <input className="input" defaultValue={template.name} onBlur={(e) => e.target.value !== template.name && saveMeta({ name: e.target.value })} />
          </div>
          <div>
            <label className="label">תיאור</label>
            <input className="input" defaultValue={template.description} onBlur={(e) => e.target.value !== template.description && saveMeta({ description: e.target.value })} />
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={template.active} onChange={(e) => saveMeta({ active: e.target.checked })} />
          <span className="text-sm font-medium text-slate-600">מפורסם למשתמשים</span>
        </label>
      </section>

      {/* Blocks */}
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-700">רכיבי הבד״ח ({blocks.length})</h2>
          <div className="relative">
            <button className="btn-primary btn-sm gap-1.5" onClick={() => setAddOpen((o) => !o)}>
              <Icon name="plus" size={16} /> הוסף רכיב
            </button>
            {addOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setAddOpen(false)} />
                <div className="absolute left-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {ADDABLE.map((type) => (
                    <button
                      key={type}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-right text-[14px] text-ink-800 hover:bg-brand-50"
                      onClick={() => pickType(type)}
                    >
                      <Icon name={BLOCK_META[type].icon} size={16} className="text-ink-400" />
                      {BLOCK_META[type].label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {blocks.map((b, i) => {
            if (b.type === 'check') checkNo += 1;
            return (
              <BlockRow
                key={b.id}
                block={b}
                index={i}
                total={blocks.length}
                checkNo={b.type === 'check' ? checkNo : null}
                task={b.type === 'check' ? tasks.get(checkTaskId(b) ?? '') : undefined}
                onDragStart={() => (dragId.current = b.id)}
                onDropOn={() => onDrop(b.id)}
                onEdit={() => setEditing({ kind: 'block', block: b })}
                onMove={(d) => move(b.id, d)}
                onDuplicate={() => duplicate(b)}
                onRemove={() => remove(b)}
                onImage={(src) => setLightbox(src)}
              />
            );
          })}
          {blocks.length === 0 && (
            <div className="py-8 text-center text-slate-400">אין רכיבים. הוסף רכיב ראשון.</div>
          )}
        </div>
      </section>

      {/* Editors */}
      {editing?.kind === 'new-check' && (
        <CheckEditor
          templateId={template.id}
          task={null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          notify={notify}
        />
      )}
      {editing?.kind === 'block' && editing.block.type === 'check' && (
        <CheckEditor
          templateId={template.id}
          task={tasks.get(checkTaskId(editing.block) ?? '') ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          notify={notify}
        />
      )}
      {editing?.kind === 'block' && editing.block.type === 'section' && (
        <SectionEditor block={editing.block} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
      {editing?.kind === 'block' && editing.block.type === 'text' && (
        <TextEditor block={editing.block} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
      {editing?.kind === 'block' && editing.block.type === 'equipment' && (
        <EquipmentEditor block={editing.block} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
      {editing?.kind === 'block' && editing.block.type === 'image' && (
        <ImageEditor block={editing.block} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} notify={notify} />
      )}
      {editing?.kind === 'block' && editing.block.type === 'table' && (
        <TableBlockEditor block={editing.block} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} notify={notify} />
      )}

      <Modal open={!!lightbox} onClose={() => setLightbox(null)} title="תמונה" maxWidth="max-w-3xl">
        {lightbox && <img src={lightbox} alt="" className="w-full rounded-lg" />}
      </Modal>
    </div>
  );
}

/** One row in the block list with a type-specific summary + actions. */
function BlockRow({
  block,
  index,
  total,
  checkNo,
  task,
  onDragStart,
  onDropOn,
  onEdit,
  onMove,
  onDuplicate,
  onRemove,
  onImage,
}: {
  block: TemplateBlock;
  index: number;
  total: number;
  checkNo: number | null;
  task?: TemplateTask;
  onDragStart: () => void;
  onDropOn: () => void;
  onEdit: () => void;
  onMove: (d: 'up' | 'down') => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onImage: (src: string) => void;
}) {
  const meta = BLOCK_META[block.type];
  const editable = block.type !== 'divider';
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropOn}
      className={`flex items-center gap-3 rounded-xl border p-3 ${
        block.type === 'section' ? 'border-brand-200 bg-brand-50/50' : 'border-slate-200 bg-white'
      }`}
    >
      <span className="cursor-grab text-slate-400" title="גרור לשינוי סדר">⠿</span>
      <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-bold text-slate-600">
        {checkNo ?? <Icon name={meta.icon} size={14} />}
      </span>
      <div className="min-w-0 flex-1">
        <BlockSummary block={block} task={task} onImage={onImage} />
      </div>
      <div className="flex items-center gap-1">
        <button className="btn-ghost !p-2 text-sm" onClick={() => onMove('up')} disabled={index === 0} title="העלה">▲</button>
        <button className="btn-ghost !p-2 text-sm" onClick={() => onMove('down')} disabled={index === total - 1} title="הורד">▼</button>
        <button className="btn-ghost !p-2" onClick={onDuplicate} title="שכפל"><Icon name="layers" size={15} /></button>
        {editable && <button className="link" onClick={onEdit}>ערוך</button>}
        <button className="link text-fault-700" onClick={onRemove}>מחק</button>
      </div>
    </div>
  );
}

function BlockSummary({ block, task, onImage }: { block: TemplateBlock; task?: TemplateTask; onImage: (src: string) => void }) {
  const meta = BLOCK_META[block.type];
  switch (block.type) {
    case 'check':
      return task ? (
        <div className="flex items-center gap-2">
          {task.image_data && (
            <button type="button" onClick={() => onImage(task.image_data!)} title="הגדל">
              <img src={task.image_data} alt="" className="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
            </button>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-slate-800">{task.part_name}</div>
            <div className="truncate text-sm text-slate-500">{task.action} · ציוד: {task.equipment || 'ללא'}</div>
          </div>
        </div>
      ) : (
        <span className="text-slate-400">סעיף בדיקה</span>
      );
    case 'section':
      return <div className="text-[15px] font-extrabold text-brand-800">{(block.config as SectionConfig).title || 'כותרת'}</div>;
    case 'text':
      return <div className="truncate text-sm text-ink-700"><span className="font-semibold text-ink-500">הוראה: </span>{(block.config as TextConfig).text || '—'}</div>;
    case 'table': {
      const c = block.config as TableConfig;
      return (
        <div>
          <div className="font-semibold text-slate-800">{c.title || 'טבלת מדידה'}</div>
          <div className="text-sm text-slate-500">
            {c.rows.length} שורות × {c.columns.length} עמודות
            {(c.rules?.length ?? 0) > 0 && <span className="text-brand-600"> · {c.rules!.length} חוקי מדידה</span>}
            {c.duration_label && <span> · משך: {c.duration_label}</span>}
          </div>
        </div>
      );
    }
    case 'image': {
      const c = block.config as ImageConfig;
      return (
        <div className="flex items-center gap-2">
          {c.image_data ? (
            <button type="button" onClick={() => onImage(c.image_data!)} title="הגדל">
              <img src={c.image_data} alt="" className="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
            </button>
          ) : (
            <Icon name="image" size={18} className="text-slate-400" />
          )}
          <div className="min-w-0">
            <div className="font-semibold text-slate-800">{c.title || 'תמונה'}</div>
            {c.description && <div className="truncate text-sm text-slate-500">{c.description}</div>}
          </div>
        </div>
      );
    }
    case 'equipment': {
      const c = block.config as EquipmentConfig;
      return (
        <div>
          <div className="font-semibold text-slate-800">{c.title || 'ציוד נדרש'}</div>
          <div className="truncate text-sm text-slate-500">{c.items.length ? c.items.join(' · ') : 'ללא פריטים'}</div>
        </div>
      );
    }
    case 'divider':
      return <div className="text-center text-sm text-slate-400">— מפריד —</div>;
    default:
      return <span>{meta.label}</span>;
  }
}

// ---------------------------------------------------------------------------
// Editors
// ---------------------------------------------------------------------------

function EditorModal({
  title,
  onClose,
  onSubmit,
  busy,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Modal
      open
      draggable
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={onSubmit}>שמור</button>
          <button type="button" className="btn-ghost" onClick={onClose}>ביטול</button>
        </div>
      }
    >
      {children}
    </Modal>
  );
}

/** Classic check-section editor (area / action / equipment / image). */
function CheckEditor({
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
  const [equipmentItems, setEquipmentItems] = useState<string[]>(() => {
    const list = equipmentItemsOf(task?.equipment_items, task?.equipment);
    return list.length ? list : [''];
  });
  const [image, setImage] = useState<string | null>(task?.image_data ?? null);
  const [busy, setBusy] = useState(false);

  const setItem = (i: number, val: string) => setEquipmentItems((prev) => prev.map((v, idx) => (idx === i ? val : v)));
  const addItem = () => setEquipmentItems((prev) => [...prev, '']);
  const removeItem = (i: number) => setEquipmentItems((prev) => (prev.length <= 1 ? [''] : prev.filter((_, idx) => idx !== i)));
  const moveItem = (i: number, dir: -1 | 1) =>
    setEquipmentItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const pickImage = async (file: File | null) => {
    if (!file) return;
    try {
      setImage(await fileToManagedDataUrl(file));
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const save = async () => {
    if (!partName.trim() || !action.trim()) {
      notify('יש למלא שם אזור ופעולה', 'error');
      return;
    }
    const items = equipmentItems.map((s) => s.trim()).filter(Boolean);
    setBusy(true);
    try {
      if (task) {
        await updateTask(task.id, { part_name: partName, action, equipment_items: items, image_data: image });
      } else {
        await addCheckBlock(templateId, { part_name: partName, action, equipment_items: items, image_data: image });
      }
      onSaved();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <EditorModal title={task ? 'עריכת סעיף בדיקה' : 'סעיף בדיקה חדש'} onClose={onClose} onSubmit={save} busy={busy}>
      <div className="space-y-4">
        <div>
          <label className="label">שם האזור</label>
          <input className="input" value={partName} onChange={(e) => setPartName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">פעולה</label>
          <input className="input" value={action} onChange={(e) => setAction(e.target.value)} />
        </div>
        <div>
          <label className="label">ציוד נדרש</label>
          <div className="space-y-2">
            {equipmentItems.map((val, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input className="input flex-1" value={val} placeholder={`פריט ציוד ${i + 1}`} onChange={(e) => setItem(i, e.target.value)} />
                <button type="button" className="btn-ghost !min-h-0 !px-1.5 !py-1.5" onClick={() => moveItem(i, -1)} disabled={i === 0}><Icon name="up" size={15} /></button>
                <button type="button" className="btn-ghost !min-h-0 !px-1.5 !py-1.5" onClick={() => moveItem(i, 1)} disabled={i === equipmentItems.length - 1}><Icon name="down" size={15} /></button>
                <button type="button" className="btn-ghost !min-h-0 !px-1.5 !py-1.5 text-fault-600" onClick={() => removeItem(i)}><Icon name="trash" size={15} /></button>
              </div>
            ))}
            <button type="button" className="btn-secondary btn-sm gap-1.5" onClick={addItem}><Icon name="plus" size={15} /> הוסף פריט ציוד</button>
          </div>
        </div>
        <div>
          <label className="label">תמונה מתארת (אופציונלי)</label>
          <div className="flex items-center gap-3">
            {image && <img src={image} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />}
            <label className="btn-outline cursor-pointer">
              {image ? 'החלף תמונה' : 'בחר תמונה'}
              <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
            </label>
            {image && <button type="button" className="btn-ghost text-fault-700" onClick={() => setImage(null)}>הסר</button>}
          </div>
        </div>
      </div>
    </EditorModal>
  );
}

function SectionEditor({ block, onClose, onSaved }: { block: TemplateBlock; onClose: () => void; onSaved: () => void }) {
  const cfg = block.config as SectionConfig;
  const [title, setTitle] = useState(cfg.title ?? '');
  const [collapsible, setCollapsible] = useState(!!cfg.collapsible);
  const save = async () => {
    await updateBlockConfig(block.id, { title: title.trim() || 'כותרת', collapsible });
    onSaved();
  };
  return (
    <EditorModal title="כותרת / Section" onClose={onClose} onSubmit={save}>
      <div className="space-y-4">
        <div>
          <label className="label">כותרת</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="למשל: בדיקות מקדימות" />
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={collapsible} onChange={(e) => setCollapsible(e.target.checked)} />
          <span className="text-sm text-ink-600">ניתן לקיפול בזמן ביצוע (בד״ח ארוך)</span>
        </label>
      </div>
    </EditorModal>
  );
}

function TextEditor({ block, onClose, onSaved }: { block: TemplateBlock; onClose: () => void; onSaved: () => void }) {
  const cfg = block.config as TextConfig;
  const [text, setText] = useState(cfg.text ?? '');
  const save = async () => {
    await updateBlockConfig(block.id, { text: text.trim() });
    onSaved();
  };
  return (
    <EditorModal title="טקסט / הוראה" onClose={onClose} onSubmit={save}>
      <div>
        <label className="label">תוכן ההוראה</label>
        <textarea className="input min-h-[130px]" value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder="למשל: יש לבצע את המדידה לאחר 4 שעות עבודה רצופות." />
      </div>
    </EditorModal>
  );
}

function EquipmentEditor({ block, onClose, onSaved }: { block: TemplateBlock; onClose: () => void; onSaved: () => void }) {
  const cfg = block.config as EquipmentConfig;
  const [title, setTitle] = useState(cfg.title ?? 'ציוד נדרש');
  const [items, setItems] = useState<string[]>(cfg.items.length ? cfg.items : ['']);
  const setItem = (i: number, v: string) => setItems((p) => p.map((x, idx) => (idx === i ? v : x)));
  const add = () => setItems((p) => [...p, '']);
  const removeI = (i: number) => setItems((p) => (p.length <= 1 ? [''] : p.filter((_, idx) => idx !== i)));
  const moveI = (i: number, dir: -1 | 1) => setItems((p) => { const j = i + dir; if (j < 0 || j >= p.length) return p; const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const save = async () => {
    await updateBlockConfig(block.id, { title: title.trim() || 'ציוד נדרש', items: items.map((s) => s.trim()).filter(Boolean) });
    onSaved();
  };
  return (
    <EditorModal title="ציוד נדרש" onClose={onClose} onSubmit={save}>
      <div className="space-y-4">
        <div>
          <label className="label">כותרת</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">פריטים</label>
          <div className="space-y-2">
            {items.map((val, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input className="input flex-1" value={val} placeholder={`פריט ${i + 1}`} onChange={(e) => setItem(i, e.target.value)} />
                <button type="button" className="btn-ghost !min-h-0 !px-1.5 !py-1.5" onClick={() => moveI(i, -1)} disabled={i === 0}><Icon name="up" size={15} /></button>
                <button type="button" className="btn-ghost !min-h-0 !px-1.5 !py-1.5" onClick={() => moveI(i, 1)} disabled={i === items.length - 1}><Icon name="down" size={15} /></button>
                <button type="button" className="btn-ghost !min-h-0 !px-1.5 !py-1.5 text-fault-600" onClick={() => removeI(i)}><Icon name="trash" size={15} /></button>
              </div>
            ))}
            <button type="button" className="btn-secondary btn-sm gap-1.5" onClick={add}><Icon name="plus" size={15} /> הוסף פריט</button>
          </div>
        </div>
      </div>
    </EditorModal>
  );
}

function ImageEditor({ block, onClose, onSaved, notify }: { block: TemplateBlock; onClose: () => void; onSaved: () => void; notify: (m: string, k?: 'ok' | 'error' | 'info') => void }) {
  const cfg = block.config as ImageConfig;
  const [image, setImage] = useState<string | null>(cfg.image_data);
  const [title, setTitle] = useState(cfg.title ?? '');
  const [description, setDescription] = useState(cfg.description ?? '');
  const [showExec, setShowExec] = useState(cfg.show_in_execution !== false);
  const [showPdf, setShowPdf] = useState(cfg.show_in_pdf !== false);
  const pick = async (file: File | null) => {
    if (!file) return;
    try { setImage(await fileToManagedDataUrl(file)); } catch (e) { notify((e as Error).message, 'error'); }
  };
  const save = async () => {
    await updateBlockConfig(block.id, { image_data: image, title: title.trim(), description: description.trim(), show_in_execution: showExec, show_in_pdf: showPdf });
    onSaved();
  };
  return (
    <EditorModal title="תמונה" onClose={onClose} onSubmit={save}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {image && <img src={image} alt="" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />}
          <label className="btn-outline cursor-pointer">
            {image ? 'החלף תמונה' : 'בחר תמונה'}
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          </label>
          {image && <button type="button" className="btn-ghost text-fault-700" onClick={() => setImage(null)}>הסר</button>}
        </div>
        <div>
          <label className="label">כותרת (אופציונלי)</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">תיאור (אופציונלי)</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={showExec} onChange={(e) => setShowExec(e.target.checked)} /><span className="text-sm text-ink-600">הצג בזמן ביצוע</span></label>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={showPdf} onChange={(e) => setShowPdf(e.target.checked)} /><span className="text-sm text-ink-600">הצג ב-PDF/הדפסה</span></label>
        </div>
      </div>
    </EditorModal>
  );
}
