import { useRef, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { authenticateApprover, finalizeApproval, rejectForm } from '@/services/approval';
import { addSignature, type FormBundle } from '@/services/forms';
import { FormStatus, SignerType, type UserWithRoles } from '@/types';
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad';
import { Modal } from '@/components/ui';
import { formatDateTime } from '@/exports/labels';

/**
 * Approver area. Rendered locked; a valid approver must verify their identity
 * before the signature surface unlocks. All rules (role, self-approval by id,
 * status) are enforced in the approval service, not just here.
 */
export function ApprovalSection({
  bundle,
  onChanged,
}: {
  bundle: FormBundle;
  onChanged: () => Promise<void>;
}) {
  const { form, signatures } = bundle;
  const { notify } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [approver, setApprover] = useState<UserWithRoles | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [signerRole, setSignerRole] = useState('');
  const [sigEmpty, setSigEmpty] = useState(true);
  const [busy, setBusy] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  const approverSig = signatures.find((s) => s.signer_type === SignerType.APPROVER);

  // ---- Already approved: show the final, locked result. ----
  if (form.status === FormStatus.APPROVED) {
    return (
      <section className="card border-r-4 border-r-ok-500 p-5">
        <h2 className="mb-1 text-lg font-bold text-ok-700">✅ הבד״ח אושר ונעל</h2>
        <p className="mb-4 text-sm text-slate-500">
          מאשר: <span className="font-semibold text-slate-700">{form.approver_name}</span> ·{' '}
          {formatDateTime(form.approved_at)}
        </p>
        {approverSig && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <img src={approverSig.signature_data} alt="חתימת מאשר" className="max-h-40 rounded-lg bg-white" />
            <div className="mt-2 text-sm text-slate-500">
              {approverSig.signer_name}
              {approverSig.signer_role ? ` · ${approverSig.signer_role}` : ''}
            </div>
          </div>
        )}
      </section>
    );
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setBusy(true);
    try {
      const a = await authenticateApprover(form, username, password);
      setApprover(a);
      setAuthOpen(false);
      setPassword('');
      notify(`אומת: ${a.full_name}`, 'ok');
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const signAndApprove = async () => {
    if (!approver) return;
    if (!sigRef.current || sigRef.current.isEmpty()) {
      notify('יש לחתום לפני האישור', 'error');
      return;
    }
    setBusy(true);
    try {
      await addSignature({
        formId: form.id,
        signer: approver,
        type: SignerType.APPROVER,
        signerRole,
        signatureData: sigRef.current.toDataURL(),
      });
      await finalizeApproval(form.id, approver);
      notify('הבד״ח אושר ונעל', 'ok');
      await onChanged();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!approver) return;
    const reason = prompt('סיבת הדחייה:');
    if (reason === null) return;
    setBusy(true);
    try {
      await rejectForm(form.id, approver, reason || '');
      notify('הבד״ח נדחה והוחזר לתיקון', 'info');
      await onChanged();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card border-r-4 border-r-pending-500 p-5">
      {!approver ? (
        // ---- Locked ----
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="text-4xl">🔒</div>
          <div className="text-lg font-bold text-slate-700">חתימת מאשר</div>
          <div className="text-sm text-slate-500">נדרשת הרשאת מאשר כדי לפתוח אזור זה</div>
          <button className="btn-primary btn-lg mt-2" onClick={() => setAuthOpen(true)}>
            פתיחת אישור
          </button>
        </div>
      ) : (
        // ---- Unlocked for the verified approver ----
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-700">חתימת מאשר הבדיקה</h2>
            <p className="text-sm text-slate-500">
              מאשר: <span className="font-semibold text-slate-700">{approver.full_name}</span>
            </p>
          </div>
          <div>
            <label className="label">תפקיד / מספר מזהה (אופציונלי)</label>
            <input
              className="input max-w-sm"
              value={signerRole}
              onChange={(e) => setSignerRole(e.target.value)}
              placeholder="לדוגמה: מהנדס / מס' מזהה"
            />
          </div>
          <SignaturePad ref={sigRef} onChange={setSigEmpty} />
          <div className="flex flex-wrap gap-3">
            <button className="btn-ok btn-lg" onClick={signAndApprove} disabled={busy || sigEmpty}>
              אשר וסגור בד״ח
            </button>
            <button className="btn-outline" onClick={reject} disabled={busy}>
              דחה / החזר לתיקון
            </button>
            <button className="btn-ghost" onClick={() => setApprover(null)} disabled={busy}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Verification modal */}
      <Modal open={authOpen} onClose={() => setAuthOpen(false)} title="אישור בד״ח — אימות מאשר">
        <form onSubmit={verify} className="space-y-4">
          <p className="text-sm text-slate-500">
            הזן את פרטי המאשר. לא ניתן לאשר בד״ח שביצעת בעצמך.
          </p>
          <div>
            <label className="label">שם משתמש מאשר</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">סיסמה</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {authError && (
            <div className="rounded-xl bg-fault-50 px-4 py-3 text-sm font-medium text-fault-700">
              {authError}
            </div>
          )}
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1" disabled={busy}>
              {busy ? 'מאמת…' : 'אישור'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setAuthOpen(false)}>
              ביטול
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
