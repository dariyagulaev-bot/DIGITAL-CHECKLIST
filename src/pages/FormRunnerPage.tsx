import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
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

  if (loading) return <Spinner label="טוען בד״ח…" />;
  if (!bundle || !user) return <div className="card p-6">הבד״ח לא נמצא.</div>;

  const { form, tasks, signatures } = bundle;
  const editable = isEditableByPerformer(form) && form.performer_user_id === user.id;
  const performerSig = signatures.find((s) => s.signer_type === SignerType.PERFORMER);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{form.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <StatusBadge status={form.status} />
            {form.status === FormStatus.APPROVED && <span>🔒 נעול</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/view/${form.id}`} className="btn-outline">
            צפייה / הדפסה
          </Link>
          {editable && (
            <button className="btn-ghost text-fault-700" onClick={removeDraft}>
              מחק טיוטה
            </button>
          )}
        </div>
      </div>

      {/* Form details */}
      <section className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-slate-700">פרטי הבד״ח</h2>
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
            <input className="input bg-slate-50" value={form.performer_name} disabled readOnly />
          </div>
        </div>
      </section>

      {/* Tasks */}
      <section className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-slate-700">טבלת הבדיקות</h2>
        <div className="space-y-3">
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
      <section className="card p-5">
        <h2 className="mb-1 text-lg font-bold text-slate-700">חתימת מבצע הבדיקה</h2>
        <p className="mb-4 text-sm text-slate-500">
          שם: <span className="font-semibold text-slate-700">{form.performer_name}</span>
        </p>

        {performerSig && !resign ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <img
              src={performerSig.signature_data}
              alt="חתימת מבצע"
              className="max-h-40 rounded-lg bg-white"
            />
            <div className="mt-2 text-sm text-slate-500">
              נחתם: {formatDateTime(performerSig.signed_at)}
              {performerSig.signer_role ? ` · ${performerSig.signer_role}` : ''}
            </div>
            {editable && (
              <button
                className="btn-ghost mt-3"
                onClick={() => {
                  setSignerRole(performerSig.signer_role);
                  setResign(true);
                }}
              >
                חתום מחדש
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
              שמור חתימה
            </button>
          </div>
        ) : (
          <div className="text-slate-400">לא נמצאה חתימת מבצע</div>
        )}
      </section>

      {/* Submit for approval */}
      {editable && (
        <section className="card p-5">
          {errors.length > 0 && (
            <div className="mb-4 rounded-xl bg-fault-50 p-4 text-sm text-fault-700">
              <div className="font-bold">לא ניתן להעביר לאישור:</div>
              <ul className="mt-1 list-disc pr-5">
                {errors.map((er, i) => (
                  <li key={i}>{er}</li>
                ))}
              </ul>
            </div>
          )}
          <button className="btn-primary btn-lg w-full sm:w-auto" onClick={submit}>
            שמור והעבר לאישור
          </button>
        </section>
      )}

      {/* Approval area (locked until an approver verifies) */}
      {(form.status === FormStatus.PENDING_APPROVAL ||
        form.status === FormStatus.APPROVED) && (
        <ApprovalSection bundle={bundle} onChanged={load} />
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

      <Modal open={!!lightbox} onClose={() => setLightbox(null)} title="תמונה" maxWidth="max-w-3xl">
        {lightbox && <img src={lightbox} alt="" className="w-full rounded-lg" />}
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
      className={`rounded-xl border p-4 ${
        isFault ? 'border-fault-200 bg-fault-50' : isOk ? 'border-ok-200 bg-ok-50/40' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
            {index}
          </span>
          <div className="min-w-0">
            <div className="font-bold text-slate-800">{task.part_name_snapshot}</div>
            <div className="text-sm text-slate-600">{task.action_snapshot}</div>
            <div className="mt-0.5 text-xs text-slate-400">
              ציוד נדרש: {task.equipment_snapshot || 'ללא'}
            </div>
          </div>
        </div>

        {task.image_snapshot && (
          <button
            className="shrink-0"
            onClick={() => onViewImage(task.image_snapshot!)}
            title="הצג תמונה מתארת"
          >
            <img
              src={task.image_snapshot}
              alt="תמונה מתארת"
              className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
            />
          </button>
        )}

        <div className="flex shrink-0 gap-2">
          <button
            className={isOk ? 'btn-ok' : 'btn-outline'}
            onClick={() => editable && onResult(TaskResult.OK)}
            disabled={!editable}
          >
            ✓ תקין
          </button>
          <button
            className={isFault ? 'btn-fault' : 'btn-outline'}
            onClick={() => editable && onResult(TaskResult.FAULT)}
            disabled={!editable}
          >
            ✕ לא תקין
          </button>
        </div>
      </div>

      {/* Fault marker: opens the detail popup (no permanent notes column). */}
      {isFault && (
        <div className="mt-3 border-t border-fault-200 pt-3">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-fault-100 px-3 py-2 text-sm font-semibold text-fault-700 hover:bg-fault-200"
            onClick={onOpenFault}
          >
            {hasDetail ? (
              <>
                <span>📝 יש פירוט תקלה</span>
                {task.fault_image && <span>· 📷</span>}
                <span className="text-xs font-normal">(לחץ לצפייה/עריכה)</span>
              </>
            ) : (
              <span>⚠ הוסף פירוט אי-תקינות</span>
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
