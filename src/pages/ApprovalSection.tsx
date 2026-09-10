import { useRef, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { canApprove } from '@/services/rbac';
import { finalizeApproval, rejectForm, SELF_APPROVAL_MESSAGE } from '@/services/approval';
import { addSignature, type FormBundle } from '@/services/forms';
import { FormStatus, SignerType } from '@/types';
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/exports/labels';

/**
 * Approver area — session-based.
 *
 * The approver signs and approves from THEIR OWN logged-in session (a separate,
 * personal login from the performer). No shared password and no re-typing of
 * credentials inside the performer's session. All rules are enforced in the
 * approval service (role, self-approval by user id, status, signature present).
 */
export function ApprovalSection({
  bundle,
  onChanged,
}: {
  bundle: FormBundle;
  onChanged: () => Promise<void>;
}) {
  const { form, signatures } = bundle;
  const { user } = useAuth();
  const { notify } = useToast();
  const [signerRole, setSignerRole] = useState('');
  const [sigEmpty, setSigEmpty] = useState(true);
  const [busy, setBusy] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

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
            <div className="mt-2 text-sm text-ink-500">
              {approverSig.signer_name}
              {approverSig.signer_role ? ` · ${approverSig.signer_role}` : ''}
            </div>
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
    return (
      <section className="card border-r-2 border-r-pending-500 p-5 sm:p-6">
        <div className="flex flex-col items-center gap-3 py-5 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-pending-50 text-pending-600 ring-1 ring-pending-100">
            <Icon name="lock" size={28} />
          </span>
          <div className="text-lg font-extrabold text-ink-900">חתימת מאשר</div>
          {isSelf ? (
            <div className="max-w-md text-sm font-semibold text-fault-600">{SELF_APPROVAL_MESSAGE}</div>
          ) : (
            <div className="max-w-md text-sm text-ink-500">
              אזור זה נעול. כדי לאשר בד״ח זה יש להתחבר עם משתמש בעל הרשאת מאשר (APPROVER).
            </div>
          )}
        </div>
      </section>
    );
  }

  // ---- Approver (this session) may sign & approve ----
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
        signerRole,
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

  const reject = async () => {
    const reason = prompt('סיבת הדחייה:');
    if (reason === null) return;
    setBusy(true);
    try {
      await rejectForm(form.id, user, reason || '');
      notify('הבד״ח נדחה והוחזר לתיקון', 'info');
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

      <div className="mb-3">
        <label className="label">תפקיד / מספר מזהה (אופציונלי)</label>
        <input
          className="input max-w-sm"
          value={signerRole}
          onChange={(e) => setSignerRole(e.target.value)}
          placeholder="לדוגמה: מהנדס / מס' מזהה"
        />
      </div>

      <SignaturePad ref={sigRef} onChange={setSigEmpty} />

      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn-ok btn-lg gap-2" onClick={approve} disabled={busy || sigEmpty}>
          <Icon name="shield-check" size={18} /> אישור בד״ח
        </button>
        <button className="btn-secondary" onClick={reject} disabled={busy}>
          דחה / החזר לתיקון
        </button>
      </div>
    </section>
  );
}
