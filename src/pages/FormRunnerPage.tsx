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

  const inputCls = 'input';

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
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
            <h1 className="truncate text-[18px] font-extrabold text-ink-900">{form.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
              {form.system_name_snapshot && (
                <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
                  <Icon name="database" size={13} /> {form.system_name_snapshot}
                </span>
              )}
              {form.unit_name_snapshot && (
                <span className="inline-flex items-center gap-1 text-ink-500">
                  <Icon name="layers" size={13} /> {form.unit_name_snapshot}
                </span>
              )}
              {form.rank_name_snapshot && (
                <span className="inline-flex items-center gap-1 text-ink-500">
                  <Icon name="shield-check" size={13} /> {form.rank_name_snapshot}
                </span>
              )}
            </div>
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

      {/* Details */}
      <section className="card">
        <div className="panel-head">
          <span className="panel-title">פרטי הבד״ח</span>
        </div>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">שם</label>
            <input
              className={inputCls}
              defaultValue={form.name}
              disabled={!editable}
              onBlur={(e) => e.target.value !== form.name && onMeta({ name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">מספר</label>
            <input
              className={inputCls}
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
              className={inputCls}
              defaultValue={form.date}
              disabled={!editable}
              onBlur={(e) => e.target.value !== form.date && onMeta({ date: e.target.value })}
            />
          </div>
          <div>
            <label className="label">מי ביצע</label>
            <div className="flex min-h-[42px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3">
              <Icon name="users" size={16} className="text-ink-400" />
              <span className="truncate text-[14px] font-semibold text-ink-800">
                {form.performer_name}
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

      {/* Performer signature */}
      <section className="card">
        <div className="panel-head">
          <span className="panel-title">חתימת מבצע הבדיקה</span>
          <span className="text-[13px] font-medium text-ink-500">{form.performer_name}</span>
        </div>
        <div className="px-5 py-4">
          {performerSig && !resign ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ok-600">
                <Icon name="check" size={15} /> נחתם
              </div>
              <img
                src={performerSig.signature_data}
                alt="חתימת מבצע"
                className="max-h-36 rounded border border-slate-200 bg-white"
              />
              <div className="mt-2 text-[13px] text-ink-500">
                {formatDateTime(performerSig.signed_at)}
                {performerSig.signer_role ? ` · ${performerSig.signer_role}` : ''}
              </div>
              {editable && (
                <button
                  className="btn-secondary btn-sm mt-3 gap-1.5"
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
              <button className="btn-primary btn-sm gap-1.5" onClick={saveSignature} disabled={sigEmpty}>
                <Icon name="check" size={16} /> שמור חתימה
              </button>
            </div>
          ) : (
            <div className="text-[14px] text-ink-400">לא נמצאה חתימת מבצע</div>
          )}
        </div>
      </section>

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
        <td className="font-semibold text-ink-900">{task.part_name_snapshot}</td>
        <td className="text-ink-700">{task.action_snapshot}</td>
        <td className="text-ink-600">{task.equipment_snapshot || 'ללא'}</td>
        <td className="text-center">
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
        <td className="whitespace-nowrap text-center">
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
