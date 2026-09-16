import { useRef, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { canApprove } from '@/services/rbac';
import { finalizeApproval, returnForFix } from '@/services/approval';
import { addSignature, type FormBundle } from '@/services/forms';
import { FormStatus, SignerType, TaskResult } from '@/types';
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad';
import { Modal } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/exports/labels';

/**
 * Approver area — session-based.
 *
 * The approver signs and approves from THEIR OWN logged-in session (a separate,
 * personal login from the performer). The approver's identity is taken from the
 * system — no name/role is typed by hand. They can either approve, or return the
 * בד״ח to the performer for correction with a mandatory note.
 */
export function ApprovalSection({
  bundle,
  onChanged,
}: {
  bundle: FormBundle;
  onChanged: () => Promise<void>;
}) {
  const { form, tasks, signatures } = bundle;
  const { user } = useAuth();
  const { notify } = useToast();
  const [sigEmpty, setSigEmpty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnGeneral, setReturnGeneral] = useState('');
  const [sectionNotes, setSectionNotes] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const sigRef = useRef<SignaturePadHandle>(null);

  const faultTasks = tasks.filter((t) => t.result === TaskResult.FAULT);
  const toggleSection = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const approverSig = signatures.find((s) => s.signer_type === SignerType.APPROVER);

  // ---- Already approved: show the final, locked result. ----
  if (form.status === FormStatus.APPROVED) {
    return (
      <section className="card border-r-2 border-r-ok-500 p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ok-100 text-ok-600">
            <Icon name="shield-check" size={22} />
          </span>
          <h2 className="text-lg font-extrabold text-ok-700">הבד״ח אושר ונעל</h2>
        </div>
        <p className="mb-4 text-sm text-ink-500">
          מאשר: <span className="font-semibold text-ink-700">{form.approver_name}</span> ·{' '}
          {formatDateTime(form.approved_at)}
        </p>
        {approverSig && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <img src={approverSig.signature_data} alt="חתימת מאשר" className="max-h-40 rounded border border-slate-200 bg-white" />
            <div className="mt-2 text-sm text-ink-500">{approverSig.signer_name}</div>
          </div>
        )}
      </section>
    );
  }

  if (!user) return null;

  const userCanApprove = canApprove(user);
  const isSelf = user.id === form.performer_user_id;

  // ---- Locked states (not an approver, or self-approval) ----
  if (!userCanApprove || isSelf) {
    // The performer viewing their own submitted בד״ח: show a plain confirmation
    // that it was handed off — not a "you can't approve your own" lock.
    if (isSelf) {
      return (
        <section className="card border-r-2 border-r-pending-500 p-5 sm:p-6">
          <div className="flex flex-col items-center gap-3 py-5 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-pending-50 text-pending-600 ring-1 ring-pending-100">
              <Icon name="shield-check" size={28} />
            </span>
            <div className="text-lg font-extrabold text-ink-900">הועבר לגורם מאשר</div>
          </div>
        </section>
      );
    }
    return (
      <section className="card border-r-2 border-r-pending-500 p-5 sm:p-6">
        <div className="flex flex-col items-center gap-3 py-5 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-pending-50 text-pending-600 ring-1 ring-pending-100">
            <Icon name="lock" size={28} />
          </span>
          <div className="text-lg font-extrabold text-ink-900">חתימת מאשר</div>
          <div className="max-w-md text-sm text-ink-500">
            אזור זה נעול. כדי לאשר בד״ח זה יש להתחבר עם משתמש בעל הרשאת מאשר (APPROVER).
          </div>
        </div>
      </section>
    );
  }

  // ---- Approver (this session) may sign & approve, or return for fix ----
  const approve = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      notify('יש לחתום לפני האישור', 'error');
      return;
    }
    setBusy(true);
    try {
      await addSignature({
        formId: form.id,
        signer: user,
        type: SignerType.APPROVER,
        signatureData: sigRef.current.toDataURL(),
      });
      await finalizeApproval(form.id, user);
      notify('הבד״ח אושר ונעל', 'ok');
      await onChanged();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitReturn = async () => {
    const sections = [...checked]
      .map((taskId) => ({ taskId, note: (sectionNotes[taskId] ?? '').trim() }))
      .filter((s) => s.note);
    const missingNote = [...checked].some((id) => !(sectionNotes[id] ?? '').trim());
    if (missingNote) {
      notify('יש לכתוב הערה לכל סעיף שנבחר', 'error');
      return;
    }
    if (sections.length === 0 && !returnGeneral.trim()) {
      notify('בחר סעיף להחזרה (עם הערה) או כתוב הערה כללית', 'error');
      return;
    }
    setBusy(true);
    try {
      await returnForFix(form.id, user, sections, returnGeneral.trim());
      notify('הבד״ח הוחזר לתיקון', 'info');
      setReturnOpen(false);
      setReturnGeneral('');
      setSectionNotes({});
      setChecked(new Set());
      await onChanged();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card border-r-2 border-r-brand-500 p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon name="shield-check" size={22} />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-ink-900">חתימת מאשר הבדיקה</h2>
          <p className="text-sm text-ink-500">
            מאשר: <span className="font-semibold text-ink-700">{user.full_name}</span>
          </p>
        </div>
      </div>

      <SignaturePad ref={sigRef} onChange={setSigEmpty} />

      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn-ok btn-lg gap-2" onClick={approve} disabled={busy || sigEmpty}>
          <Icon name="shield-check" size={18} /> אישור בד״ח
        </button>
        <button className="btn-secondary gap-2" onClick={() => setReturnOpen(true)} disabled={busy}>
          <Icon name="back" size={17} /> החזר לתיקון
        </button>
      </div>

      <Modal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        title="החזרת בד״ח לתיקון"
        tone="fault"
        icon="alert"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {faultTasks.length > 0 ? (
            <div>
              <label className="label">בחר את הסעיפים להחזרה לתיקון והוסף הערה לכל אחד</label>
              <div className="space-y-2">
                {faultTasks.map((t) => {
                  const on = checked.has(t.id);
                  return (
                    <div
                      key={t.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        on ? 'border-fault-300 bg-fault-50/60' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSection(t.id)}
                        className="flex w-full items-start gap-2.5 text-right"
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-2 ${
                            on ? 'border-fault-500 bg-fault-500 text-white' : 'border-slate-300'
                          }`}
                        >
                          {on && <Icon name="check" size={13} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold text-ink-900">
                            {t.part_name_snapshot} · {t.action_snapshot}
                          </span>
                          {t.comment.trim() && (
                            <span className="block truncate text-[12.5px] text-ink-500">
                              תקלה: {t.comment}
                            </span>
                          )}
                        </span>
                      </button>
                      {on && (
                        <textarea
                          className="input mt-2 min-h-[70px] text-[13.5px]"
                          value={sectionNotes[t.id] ?? ''}
                          onChange={(e) =>
                            setSectionNotes((p) => ({ ...p, [t.id]: e.target.value }))
                          }
                          placeholder="הערת המאשר / מה יש לתקן בסעיף זה…"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-ink-500">אין בבד״ח סעיפים המסומנים כלא תקינים.</p>
          )}

          <div>
            <label className="label">הערה כללית (אופציונלי)</label>
            <textarea
              className="input min-h-[70px]"
              value={returnGeneral}
              onChange={(e) => setReturnGeneral(e.target.value)}
              placeholder="הערה כללית למבצע…"
            />
          </div>

          <p className="text-[12.5px] text-ink-500">
            החזרה לתיקון מבטלת את החתימות הקיימות — יידרשו חתימות מחדש לאחר תיעוד הטיפול.
          </p>
          <div className="flex gap-3">
            <button className="btn-danger-solid flex-1" onClick={submitReturn} disabled={busy}>
              <Icon name="back" size={17} /> החזר לתיקון
            </button>
            <button className="btn-ghost" onClick={() => setReturnOpen(false)} disabled={busy}>
              ביטול
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
