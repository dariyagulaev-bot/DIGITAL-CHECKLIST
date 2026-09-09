import { useCallback, useEffect, useRef, useState } from 'react';
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
import { FormStatus, SignerType, TaskResult, type CompletedTask } from '@/types';
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad';
import { Modal, Spinner, StatusBadge } from '@/components/ui';
import { FaultModal } from '@/components/FaultModal';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/exports/labels';
import { ApprovalSection } from './ApprovalSection';

export default function FormRunnerPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [bundle, setBundle] = useState<FormBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const sigRef = useRef<SignaturePadHandle>(null);
  const [signerRole, setSignerRole] = useState('');
  const [sigEmpty, setSigEmpty] = useState(true);
  const [resign, setResign] = useState(false);
  const [faultTaskId, setFaultTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const b = await getFormBundle(id);
    setBundle(b);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Guard back-navigation when a signature has been drawn but not yet saved.
  const dirtyRef = useRef(false);
  const saveSigRef = useRef<() => Promise<void>>(async () => {});
  useUnsavedGuard(
    () => dirtyRef.current,
    () => saveSigRef.current()
  );

  if (loading) return <Spinner label="טוען בד״ח…" />;
  if (!bundle || !user) return <div className="card p-6">הבד״ח לא נמצא.</div>;

  const { form, tasks, signatures } = bundle;
  const editable = isEditableByPerformer(form) && form.performer_user_id === user.id;
  const performerSig = signatures.find((s) => s.signer_type === SignerType.PERFORMER);

  const total = tasks.length;
  const marked = tasks.filter((t) => t.result !== TaskResult.UNSET).length;
  const faultCount = tasks.filter((t) => t.result === TaskResult.FAULT).length;
  const progress = total ? Math.round((marked / total) * 100) : 0;

  const onMeta = async (patch: Partial<typeof form>) => {
    try {
      await updateFormMeta(form.id, user.id, patch);
      await load();
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const onResult = async (task: CompletedTask, result: TaskResult) => {
    // Toggle off if the same result is tapped again.
    const next = task.result === result ? TaskResult.UNSET : result;
    // Warn before discarding an existing fault detail when leaving "לא תקין".
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
      // Marking "לא תקין" opens the fault-detail popup automatically.
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

  const saveSignature = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      notify('יש לחתום לפני השמירה', 'error');
      return;
    }
    try {
      await addSignature({
        formId: form.id,
        signer: user,
        type: SignerType.PERFORMER,
        signerRole,
        signatureData: sigRef.current.toDataURL(),
      });
      notify('חתימת המבצע נשמרה', 'ok');
      setResign(false);
      await load();
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const submit = async () => {
    const v = await validateForSubmit(form.id);
    if (!v.ok) {
      setErrors(v.errors);
      notify('הבד״ח אינו שלם', 'error');
      return;
    }
    try {
      await submitForApproval(form.id, user.id);
      notify('הבד״ח הועבר לאישור', 'ok');
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

  // Keep the guard refs current for this render.
  const signaturePadShown = !performerSig || resign;
  dirtyRef.current = editable && signaturePadShown && !sigEmpty;
  saveSigRef.current = saveSignature;

  return (
    <div className="space-y-5 pb-24">
      {/* Header card with progress */}
      <section className="card anim-fade-in p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <StatusBadge status={form.status} />
              {form.status === FormStatus.APPROVED && (
                <span className="badge bg-slate-100 text-slate-500">
                  <Icon name="lock" size={13} /> נעול
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl font-extrabold text-ink-900">{form.name}</h1>
          </div>
          <div className="flex gap-2">
            <Link to={`/view/${form.id}`} className="btn-outline btn-sm gap-1.5">
              <Icon name="eye" size={16} /> צפייה / הדפסה
            </Link>
            {editable && (
              <button className="btn-danger btn-sm gap-1.5" onClick={removeDraft}>
                <Icon name="trash" size={16} /> מחק
              </button>
            )}
          </div>
        </div>

        {/* progress meter */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-bold text-ink-700">התקדמות הבדיקה</span>
            <span className="nums font-bold text-slate-500">
              {marked} / {total} סעיפים
              {faultCount > 0 && <span className="text-fault-600"> · {faultCount} תקלות</span>}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background:
                  faultCount > 0
                    ? 'linear-gradient(90deg,#059669,#f59e0b)'
                    : 'linear-gradient(90deg,#4f46e5,#06b6d4)',
              }}
            />
          </div>
        </div>
      </section>

      {/* Form details */}
      <section className="card p-5 sm:p-6">
        <div className="eyebrow mb-4">פרטי הבד״ח</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">שם</label>
            <input
              className="input"
              defaultValue={form.name}
              disabled={!editable}
              onBlur={(e) => e.target.value !== form.name && onMeta({ name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">מספר</label>
            <input
              className="input"
              defaultValue={form.number}
              disabled={!editable}
              onBlur={(e) => e.target.value !== form.number && onMeta({ number: e.target.value })}
              placeholder="—"
            />
          </div>
          <div>
            <label className="label">תאריך</label>
            <input
              type="date"
              className="input"
              defaultValue={form.date}
              disabled={!editable}
              onBlur={(e) => e.target.value !== form.date && onMeta({ date: e.target.value })}
            />
          </div>
          <div>
            <label className="label">מי ביצע</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">
                {form.performer_name.slice(0, 1)}
              </span>
              <span className="truncate text-[15px] font-semibold text-ink-800">
                {form.performer_name}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Tasks */}
      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="eyebrow">רשימת הבדיקות</div>
          <span className="nums text-sm font-bold text-slate-400">{total} סעיפים</span>
        </div>
        <div className="space-y-2.5">
          {tasks.map((task, idx) => (
            <TaskCard
              key={task.id}
              index={idx + 1}
              task={task}
              editable={editable}
              onResult={(r) => onResult(task, r)}
              onOpenFault={() => openFault(task)}
              onViewImage={(src) => setLightbox(src)}
            />
          ))}
          {tasks.length === 0 && (
            <div className="py-8 text-center text-slate-400">אין בדיקות בבד״ח זה</div>
          )}
        </div>
      </section>

      {/* Performer signature */}
      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon name="pen" size={19} />
          </span>
          <div>
            <div className="font-display text-lg font-extrabold text-ink-900">חתימת מבצע הבדיקה</div>
            <div className="text-sm text-slate-500">{form.performer_name}</div>
          </div>
        </div>

        {performerSig && !resign ? (
          <div className="rounded-2xl border border-ok-200 bg-ok-50/50 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ok-700">
              <Icon name="check" size={16} /> נחתם
            </div>
            <img
              src={performerSig.signature_data}
              alt="חתימת מבצע"
              className="max-h-40 rounded-lg bg-white"
            />
            <div className="mt-2 text-sm text-slate-500">
              {formatDateTime(performerSig.signed_at)}
              {performerSig.signer_role ? ` · ${performerSig.signer_role}` : ''}
            </div>
            {editable && (
              <button
                className="btn-ghost btn-sm mt-3"
                onClick={() => {
                  setSignerRole(performerSig.signer_role);
                  setResign(true);
                }}
              >
                <Icon name="refresh" size={15} /> חתום מחדש
              </button>
            )}
          </div>
        ) : editable ? (
          <div className="space-y-3">
            <div>
              <label className="label">תפקיד / מספר מזהה (אופציונלי)</label>
              <input
                className="input max-w-sm"
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
                placeholder="לדוגמה: טכנאי / מס' עובד"
              />
            </div>
            <SignaturePad ref={sigRef} onChange={setSigEmpty} />
            <button className="btn-primary" onClick={saveSignature} disabled={sigEmpty}>
              <Icon name="check" size={18} /> שמור חתימה
            </button>
          </div>
        ) : (
          <div className="text-slate-400">לא נמצאה חתימת מבצע</div>
        )}
      </section>

      {/* Approval area (locked until an approver verifies) */}
      {(form.status === FormStatus.PENDING_APPROVAL || form.status === FormStatus.APPROVED) && (
        <ApprovalSection bundle={bundle} onChanged={load} />
      )}

      {/* Sticky submit bar */}
      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-20 no-print">
          <div className="mx-auto max-w-6xl px-4 pb-4">
            <div className="card flex flex-wrap items-center justify-between gap-3 border-slate-200 p-3 shadow-lift sm:p-4">
              <div className="flex items-center gap-2 text-sm">
                {marked === total && total > 0 ? (
                  <span className="flex items-center gap-1.5 font-bold text-ok-700">
                    <Icon name="check" size={16} /> כל הסעיפים סומנו
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-semibold text-slate-500">
                    <Icon name="clock" size={16} /> נותרו {total - marked} סעיפים לסימון
                  </span>
                )}
              </div>
              <button className="btn-primary btn-lg w-full sm:w-auto" onClick={submit}>
                שמור והעבר לאישור
                <Icon name="arrow-start" size={18} />
              </button>
            </div>
            {errors.length > 0 && (
              <div className="card mt-2 border-fault-200 bg-fault-50 p-3.5 text-sm text-fault-700">
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
        {lightbox && <img src={lightbox} alt="" className="w-full rounded-xl" />}
      </Modal>
    </div>
  );
}

function TaskCard({
  index,
  task,
  editable,
  onResult,
  onOpenFault,
  onViewImage,
}: {
  index: number;
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
    <div
      className={`rounded-2xl border p-3.5 transition-colors sm:p-4 ${
        isFault
          ? 'border-fault-200 bg-fault-50/70'
          : isOk
            ? 'border-ok-200 bg-ok-50/50'
            : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={`nums flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold ${
              isFault
                ? 'bg-fault-100 text-fault-700'
                : isOk
                  ? 'bg-ok-100 text-ok-700'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            {index}
          </span>
          <div className="min-w-0">
            <div className="font-bold text-ink-900">{task.part_name_snapshot}</div>
            <div className="text-sm text-slate-600">{task.action_snapshot}</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <Icon name="shield-check" size={13} />
              ציוד נדרש: {task.equipment_snapshot || 'ללא'}
            </div>
          </div>
        </div>

        {task.image_snapshot && (
          <button
            className="group relative shrink-0 self-start sm:self-center"
            onClick={() => onViewImage(task.image_snapshot!)}
            title="הצג תמונה מתארת"
          >
            <img
              src={task.image_snapshot}
              alt="תמונה מתארת"
              className="h-16 w-16 rounded-xl border border-slate-200 object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-ink-900/0 text-white opacity-0 transition-all group-hover:bg-ink-900/45 group-hover:opacity-100">
              <Icon name="search" size={18} />
            </span>
          </button>
        )}

        {/* Segmented pass/fail control */}
        <div className="seg shrink-0">
          <button
            className={`seg-btn ${isOk ? 'seg-btn-ok-active' : ''}`}
            onClick={() => editable && onResult(TaskResult.OK)}
            disabled={!editable}
          >
            <Icon name="check" size={17} /> תקין
          </button>
          <button
            className={`seg-btn ${isFault ? 'seg-btn-fault-active' : ''}`}
            onClick={() => editable && onResult(TaskResult.FAULT)}
            disabled={!editable}
          >
            <Icon name="x" size={17} /> לא תקין
          </button>
        </div>
      </div>

      {/* Fault marker: opens the detail popup (no permanent notes column). */}
      {isFault && (
        <div className="mt-3 border-t border-fault-200 pt-3">
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-fault-100 px-3 py-2 text-sm font-bold text-fault-700 transition-colors hover:bg-fault-200"
            onClick={onOpenFault}
          >
            {hasDetail ? (
              <>
                <Icon name="file" size={15} /> יש פירוט תקלה
                {task.fault_image && <Icon name="camera" size={15} />}
                <span className="text-xs font-semibold opacity-70">(עריכה)</span>
              </>
            ) : (
              <>
                <Icon name="alert" size={15} /> הוסף פירוט אי-תקינות
              </>
            )}
          </button>
          {hasDetail && task.comment.trim() && (
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{task.comment}</p>
          )}
        </div>
      )}
    </div>
  );
}
