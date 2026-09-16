import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useUnsavedGuard } from '@/context/NavGuardContext';
import {
  addSignature,
  deleteDraft,
  getFormBundle,
  isEditableByPerformer,
  setTaskComment,
  setTaskFaultImage,
  setTaskResult,
  submitForApproval,
  updateFormMeta,
  validateForSubmit,
  type FormBundle,
} from '@/services/forms';
import { fileToManagedDataUrl } from '@/services/images';
import { listPerformerUsers } from '@/services/auth';
import { FormStatus, SignerType, TaskResult, type CompletedTask, type Signature } from '@/types';
import { equipmentItemsOf, formatDateDots, formatDateTime } from '@/exports/labels';
import { PerformerSelect } from '@/components/PerformerSelect';
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad';
import { Modal, Spinner, StatusBadge } from '@/components/ui';
import { FaultModal } from '@/components/FaultModal';
import { Icon } from '@/components/Icon';
import { ApprovalSection } from './ApprovalSection';

interface PerfSigHandle {
  isDirty: () => boolean;
  save: () => Promise<void>;
}

export default function FormRunnerPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [bundle, setBundle] = useState<FormBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const performer2Ref = useRef<HTMLButtonElement>(null);
  const [performers, setPerformers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [faultTaskId, setFaultTaskId] = useState<string | null>(null);
  const [checkedTools, setCheckedTools] = useState<Set<string>>(new Set());

  const sig1 = useRef<PerfSigHandle>(null);
  const sig2 = useRef<PerfSigHandle>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const b = await getFormBundle(id);
    setBundle(b);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // מבצע 2 options: real active users who hold the PERFORMER role (offline, local DB).
  useEffect(() => {
    listPerformerUsers().then(setPerformers).catch(() => setPerformers([]));
  }, []);

  // Guard back-navigation while either performer has drawn but not saved a signature.
  useUnsavedGuard(
    () => !!(sig1.current?.isDirty() || sig2.current?.isDirty()),
    async () => {
      await sig1.current?.save();
      await sig2.current?.save();
    }
  );

  if (loading) return <Spinner label="טוען בד״ח…" />;
  if (!bundle || !user) return <div className="card p-6">הבד״ח לא נמצא.</div>;

  const { form, tasks, signatures } = bundle;
  const editable = isEditableByPerformer(form) && form.performer_user_id === user.id;
  const perf1Sig = signatures.find((s) => s.signer_type === SignerType.PERFORMER);
  const perf2Sig = signatures.find((s) => s.signer_type === SignerType.PERFORMER2);

  const total = tasks.length;
  const marked = tasks.filter((t) => t.result !== TaskResult.UNSET).length;
  const faultCount = tasks.filter((t) => t.result === TaskResult.FAULT).length;
  const progress = total ? Math.round((marked / total) * 100) : 0;

  // Consolidated shopping-list of all unique equipment across the whole בד״ח —
  // a pre-work aid for the performer only (never shown in view / PDF / print).
  const toolList: string[] = [];
  const seenTool = new Set<string>();
  for (const t of tasks) {
    for (const it of equipmentItemsOf(t.equipment_items_snapshot, t.equipment_snapshot)) {
      if (!seenTool.has(it)) {
        seenTool.add(it);
        toolList.push(it);
      }
    }
  }

  const onPickPerformer2 = async (sel: { id: string; name: string }) => {
    try {
      await updateFormMeta(form.id, user.id, { performer2_id: sel.id, performer2_name: sel.name });
      await load();
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const onResult = async (task: CompletedTask, result: TaskResult) => {
    const next = task.result === result ? TaskResult.UNSET : result;
    if (
      task.result === TaskResult.FAULT &&
      next !== TaskResult.FAULT &&
      (task.comment.trim() || task.fault_image)
    ) {
      const ok = confirm(
        'קיים פירוט אי-תקינות עבור שורה זו. שינוי הסימון ימחק את הפירוט והתמונה. להמשיך?'
      );
      if (!ok) return;
    }
    try {
      await setTaskResult(form.id, user.id, task.id, next);
      await load();
      if (next === TaskResult.FAULT) setFaultTaskId(task.id);
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const openFault = (task: CompletedTask) => setFaultTaskId(task.id);
  const onComment = async (task: CompletedTask, comment: string) => {
    try {
      await setTaskComment(form.id, user.id, task.id, comment);
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };
  const onFaultImage = async (task: CompletedTask, file: File | null) => {
    try {
      const data = file ? await fileToManagedDataUrl(file) : null;
      await setTaskFaultImage(form.id, user.id, task.id, data);
      await load();
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const saveSig = async (type: SignerType, signer: { id: string; full_name: string }, dataUrl: string) => {
    try {
      await addSignature({ formId: form.id, signer, type, signatureData: dataUrl });
      notify('החתימה נשמרה', 'ok');
      await load();
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const submit = async () => {
    if (!form.performer2_name?.trim()) {
      notify('יש לבחור מבצע שני. הבדיקה מחייבת שני מבצעים.', 'error');
      performer2Ref.current?.focus();
      performer2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setErrors(['יש לבחור מבצע שני. הבדיקה מחייבת שני מבצעים.']);
      return;
    }
    const v = await validateForSubmit(form.id);
    if (!v.ok) {
      setErrors(v.errors);
      notify('הבד״ח אינו שלם', 'error');
      return;
    }
    try {
      await submitForApproval(form.id, user.id);
      setErrors([]);
      notify('הועבר לגורם מאשר', 'ok');
      await load();
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const removeDraft = async () => {
    if (!confirm('למחוק את הטיוטה? פעולה זו אינה הפיכה.')) return;
    try {
      await deleteDraft(form.id, user.id);
      notify('הטיוטה נמחקה', 'ok');
      navigate('/my');
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const returned = form.status === FormStatus.REJECTED;

  return (
    <div className="space-y-4 pb-24">
      {/* Header — fixed, non-editable identity: system | system number | date */}
      <section className="card">
        <div className="panel-head">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <StatusBadge status={form.status} />
              {form.status === FormStatus.APPROVED && (
                <span className="badge border-slate-200 bg-slate-100 text-slate-600">
                  <Icon name="lock" size={12} /> נעול
                </span>
              )}
            </div>
            {/* Fixed, automatic title: system name · system number · date.
                Each field is bidi-isolated so numbers/date never bleed between
                boxes in the RTL layout. */}
            <h1
              dir="rtl"
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[18px] font-extrabold leading-snug text-ink-900"
            >
              {form.system_name_snapshot && <bdi>{form.system_name_snapshot}</bdi>}
              {form.unit_name_snapshot && (
                <>
                  <span className="font-normal text-ink-300">|</span>
                  <span>
                    מספר מערכת <bdi>{form.unit_name_snapshot}</bdi>
                  </span>
                </>
              )}
              <span className="font-normal text-ink-300">|</span>
              <bdi>{formatDateDots(form.date)}</bdi>
            </h1>
            {form.rank_name_snapshot && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                <span className="inline-flex items-center gap-1 text-ink-500">
                  <Icon name="shield-check" size={13} /> {form.rank_name_snapshot}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Link to={`/view/${form.id}`} className="btn-secondary btn-sm gap-1.5">
              <Icon name="eye" size={16} /> צפייה / הדפסה
            </Link>
            {editable && (
              <button className="btn-danger btn-sm gap-1.5" onClick={removeDraft}>
                <Icon name="trash" size={16} /> מחק
              </button>
            )}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <span className="font-semibold text-ink-600">התקדמות הבדיקה</span>
            <span className="nums font-medium text-ink-500">
              {marked}/{total} סעיפים
              {faultCount > 0 && <span className="text-fault-600"> · {faultCount} תקלות</span>}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      {/* Returned-for-fix banner + approver note (performer must see it clearly) */}
      {returned && (
        <section className="card border-r-2 border-r-fault-500 bg-fault-50/60 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-fault-100 text-fault-600">
              <Icon name="alert" size={20} />
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold text-fault-700">הבד״ח הוחזר לתיקון</div>
              {form.rejection_note && (
                <div className="mt-1 rounded-md border border-fault-200 bg-white px-3 py-2 text-[14px] text-ink-800">
                  {form.rejection_note}
                </div>
              )}
              <div className="mt-1.5 text-[12.5px] text-ink-500">
                {form.rejected_by_name ? `מאת: ${form.rejected_by_name}` : ''}
                {form.rejected_at ? ` · ${formatDateTime(form.rejected_at)}` : ''}
              </div>
              <div className="mt-2 text-[13px] font-medium text-ink-600">
                בצע את התיקונים הנדרשים, חתום מחדש (שני המבצעים) ושלח שוב לאישור.
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Consolidated equipment checklist — a pre-work aid for the performer only,
          shown while the בד״ח is still editable. Once it is submitted for approval
          it disappears, so the approver (and any later viewer) never sees it.
          Deliberately NOT part of the report / PDF / print / view either. */}
      {editable && toolList.length > 0 && (
        <section className="card no-print">
          <div className="panel-head">
            <span className="panel-title">ציוד נדרש לבדיקה</span>
            <span className="text-[12.5px] font-medium text-ink-400">רשימת ריכוז — לוודא לפני התחלה</span>
          </div>
          <div className="grid gap-x-6 gap-y-1.5 px-5 py-4 sm:grid-cols-2">
            {toolList.map((tool) => {
              const on = checkedTools.has(tool);
              return (
                <button
                  key={tool}
                  type="button"
                  onClick={() =>
                    setCheckedTools((prev) => {
                      const next = new Set(prev);
                      next.has(tool) ? next.delete(tool) : next.add(tool);
                      return next;
                    })
                  }
                  className="flex items-center gap-2.5 py-1 text-right text-[14px]"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors ${
                      on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {on && <Icon name="check" size={13} />}
                  </span>
                  <span className={on ? 'text-ink-400 line-through' : 'text-ink-800'}>{tool}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Details — the only editable field is מבצע 2 (name/date are set by the system) */}
      <section className="card">
        <div className="panel-head">
          <span className="panel-title">פרטי הבד״ח</span>
        </div>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">מבצע 1</label>
            <div className="flex min-h-[42px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3">
              <Icon name="users" size={16} className="text-ink-400" />
              <span className="truncate text-[14px] font-semibold text-ink-800">
                {form.performer_name}
              </span>
            </div>
          </div>
          <div>
            <label className="label">מבצע 2</label>
            <PerformerSelect
              ref={performer2Ref}
              options={performers}
              value={form.performer2_id}
              valueName={form.performer2_name}
              excludeId={form.performer_user_id}
              excludeName={form.performer_name}
              disabled={!editable}
              onChange={onPickPerformer2}
            />
          </div>
          <div>
            <label className="label">סיווג</label>
            <div className="flex min-h-[42px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3">
              <Icon name="lock" size={15} className="text-ink-400" />
              <span className="truncate text-[14px] font-semibold text-ink-800">
                {form.classification ?? 'בלמ״ס'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Tasks table */}
      <section className="card overflow-hidden">
        <div className="panel-head">
          <span className="panel-title">רשימת הבדיקות</span>
          <span className="nums text-[13px] font-medium text-ink-400">{total} סעיפים</span>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>שם האזור</th>
                <th>פעולה</th>
                <th>ציוד נדרש</th>
                <th className="text-center">תמונה</th>
                <th className="whitespace-nowrap text-center">תוצאה</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  editable={editable}
                  onResult={(r) => onResult(task, r)}
                  onOpenFault={() => openFault(task)}
                  onViewImage={(src) => setLightbox(src)}
                />
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-ink-400">
                    אין בדיקות בבד״ח זה
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Two performer signatures (drawn on the touch screen; no manual fields) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <PerformerSignature
          ref={sig1}
          title="חתימת מבצע 1"
          signerName={form.performer_name}
          existing={perf1Sig}
          editable={editable}
          notify={notify}
          onSave={(dataUrl) =>
            saveSig(SignerType.PERFORMER, { id: form.performer_user_id, full_name: form.performer_name }, dataUrl)
          }
        />
        <PerformerSignature
          ref={sig2}
          title="חתימת מבצע 2"
          signerName={form.performer2_name}
          existing={perf2Sig}
          editable={editable && !!form.performer2_id}
          disabledHint={!form.performer2_id ? 'יש לבחור תחילה מבצע 2' : undefined}
          notify={notify}
          onSave={(dataUrl) =>
            saveSig(
              SignerType.PERFORMER2,
              { id: form.performer2_id ?? '', full_name: form.performer2_name },
              dataUrl
            )
          }
        />
      </div>

      {/* Approval area */}
      {(form.status === FormStatus.PENDING_APPROVAL || form.status === FormStatus.APPROVED) && (
        <ApprovalSection bundle={bundle} onChanged={load} />
      )}

      {errors.length > 0 && (
        <div className="card border-fault-200 bg-fault-50 p-4 text-[13.5px] text-fault-700">
          <div className="flex items-center gap-1.5 font-bold">
            <Icon name="alert" size={16} /> לא ניתן להעביר לאישור:
          </div>
          <ul className="mt-1 list-disc pr-6">
            {errors.map((er, i) => (
              <li key={i}>{er}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sticky submit */}
      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-20 no-print border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-1.5 text-[13px]">
              {marked === total && total > 0 ? (
                <span className="flex items-center gap-1.5 font-semibold text-ok-600">
                  <Icon name="check" size={16} /> כל הסעיפים סומנו
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-medium text-ink-500">
                  <Icon name="clock" size={16} /> נותרו {total - marked} סעיפים לסימון
                </span>
              )}
            </div>
            <button className="btn-primary btn-lg gap-2" onClick={submit}>
              סיום והעברה לאישור
              <Icon name="arrow-start" size={17} />
            </button>
          </div>
        </div>
      )}

      <FaultModal
        open={!!faultTaskId}
        task={tasks.find((t) => t.id === faultTaskId) ?? null}
        editable={editable}
        onClose={() => setFaultTaskId(null)}
        onSaveDetail={async (text) => {
          const t = tasks.find((x) => x.id === faultTaskId);
          if (t) await onComment(t, text);
          await load();
        }}
        onSetImage={async (file) => {
          const t = tasks.find((x) => x.id === faultTaskId);
          if (t) await onFaultImage(t, file);
        }}
        onViewImage={(src) => setLightbox(src)}
        notifyError={(m) => notify(m, 'error')}
      />

      <Modal
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        title="תמונה מתארת"
        maxWidth="max-w-3xl"
        tone="neutral"
        icon="image"
      >
        {lightbox && <img src={lightbox} alt="" className="w-full rounded-md" />}
      </Modal>
    </div>
  );
}

/**
 * One performer signature block. Draws on the touch screen; the signer identity
 * (name) is loaded from the system, never typed. Exposes dirty/save so the page
 * can auto-save a drawn-but-unsaved signature on back-navigation.
 */
const PerformerSignature = forwardRef<
  PerfSigHandle,
  {
    title: string;
    signerName: string;
    existing: Signature | undefined;
    editable: boolean;
    disabledHint?: string;
    notify: (m: string, k?: 'ok' | 'error' | 'info') => void;
    onSave: (dataUrl: string) => Promise<void>;
  }
>(function PerformerSignature({ title, signerName, existing, editable, disabledHint, notify, onSave }, ref) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [empty, setEmpty] = useState(true);
  const [resign, setResign] = useState(false);
  const showPad = editable && (!existing || resign);

  const save = async () => {
    if (!padRef.current || padRef.current.isEmpty()) {
      notify('יש לחתום לפני השמירה', 'error');
      return;
    }
    await onSave(padRef.current.toDataURL());
    setResign(false);
  };

  useImperativeHandle(ref, () => ({
    isDirty: () => showPad && !empty,
    save: async () => {
      if (showPad && !empty) await save();
    },
  }));

  return (
    <section className="card">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        <span className="text-[13px] font-medium text-ink-500">{signerName || '—'}</span>
      </div>
      <div className="px-5 py-4">
        {existing && !resign ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ok-600">
              <Icon name="check" size={15} /> נחתם
            </div>
            <img
              src={existing.signature_data}
              alt="חתימה"
              className="max-h-36 rounded border border-slate-200 bg-white"
            />
            <div className="mt-2 text-[13px] text-ink-500">
              {existing.signer_name} · {formatDateTime(existing.signed_at)}
            </div>
            {editable && (
              <button className="btn-secondary btn-sm mt-3 gap-1.5" onClick={() => setResign(true)}>
                <Icon name="refresh" size={15} /> חתום מחדש
              </button>
            )}
          </div>
        ) : editable ? (
          <div className="space-y-3">
            <SignaturePad ref={padRef} onChange={setEmpty} />
            <button className="btn-primary btn-sm gap-1.5" onClick={save} disabled={empty}>
              <Icon name="check" size={16} /> שמור חתימה
            </button>
          </div>
        ) : (
          <div className="text-[14px] text-ink-400">{disabledHint ?? 'לא נמצאה חתימה'}</div>
        )}
      </div>
    </section>
  );
});

/** Equipment shown as an orderly stacked list inside the single "ציוד נדרש" cell. */
function EquipmentCell({ items, fallback }: { items?: string[]; fallback?: string }) {
  const list = equipmentItemsOf(items, fallback);
  if (list.length === 0) return <span className="text-ink-400">ללא</span>;
  if (list.length === 1) return <span>{list[0]}</span>;
  return (
    <ul className="space-y-0.5">
      {list.map((it, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="mt-[1px] shrink-0 text-ink-300">•</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function TaskRow({
  task,
  editable,
  onResult,
  onOpenFault,
  onViewImage,
}: {
  task: CompletedTask;
  editable: boolean;
  onResult: (r: TaskResult) => void;
  onOpenFault: () => void;
  onViewImage: (src: string) => void;
}) {
  const isOk = task.result === TaskResult.OK;
  const isFault = task.result === TaskResult.FAULT;
  const hasDetail = !!(task.comment.trim() || task.fault_image);

  return (
    <>
      <tr className={`row-hover ${isFault ? 'bg-fault-50/40' : isOk ? 'bg-ok-50/30' : ''}`}>
        <td className="align-top font-semibold text-ink-900">{task.part_name_snapshot}</td>
        <td className="align-top text-ink-700">{task.action_snapshot}</td>
        <td className="align-top text-ink-600">
          <EquipmentCell items={task.equipment_items_snapshot} fallback={task.equipment_snapshot} />
        </td>
        <td className="text-center align-top">
          {task.image_snapshot ? (
            <button
              className="group relative mx-auto block h-11 w-11"
              onClick={() => onViewImage(task.image_snapshot!)}
              title="הצג תמונה מתארת"
            >
              <img
                src={task.image_snapshot}
                alt="תמונה מתארת"
                className="h-11 w-11 rounded border border-slate-200 object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded bg-ink-950/0 text-white opacity-0 transition-all group-hover:bg-ink-950/45 group-hover:opacity-100">
                <Icon name="search" size={15} />
              </span>
            </button>
          ) : (
            <span className="text-ink-300">—</span>
          )}
        </td>
        <td className="whitespace-nowrap text-center align-top">
          <div className="inline-flex">
            <div className="seg">
              <button
                type="button"
                className={`seg-btn ${isOk ? 'seg-on-ok' : ''}`}
                onClick={() => editable && onResult(TaskResult.OK)}
                disabled={!editable}
              >
                <Icon name="check" size={16} /> תקין
              </button>
              <button
                type="button"
                className={`seg-btn ${isFault ? 'seg-on-fault' : ''}`}
                onClick={() => editable && onResult(TaskResult.FAULT)}
                disabled={!editable}
              >
                <Icon name="x" size={16} /> לא תקין
              </button>
            </div>
          </div>
        </td>
      </tr>
      {isFault && (
        <tr className="bg-fault-50/40">
          <td colSpan={5} className="border-r-2 border-r-fault-500 !py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenFault}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fault-700 hover:underline"
              >
                <Icon name={hasDetail ? 'file' : 'alert'} size={15} />
                {hasDetail ? 'יש פירוט תקלה' : 'הוסף פירוט אי-תקינות'}
                {hasDetail && task.fault_image && <Icon name="camera" size={15} />}
              </button>
              {hasDetail && task.comment.trim() && (
                <span className="truncate text-[13px] text-ink-600">— {task.comment}</span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
