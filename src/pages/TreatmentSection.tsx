import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { isUserCertified } from '@/services/certifications';
import { isAdmin } from '@/services/rbac';
import {
  listTreatmentPerformerCandidates,
  setTreatmentPerformers,
  reportTreatment,
  submitTreatmentForApproval,
  validateTreatmentForApproval,
} from '@/services/treatment';
import { addSignature, type FormBundle } from '@/services/forms';
import { SignerType } from '@/types';
import { PerformerSelect } from '@/components/PerformerSelect';
import { RepairModal } from '@/components/RepairModal';
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad';
import { Icon } from '@/components/Icon';
import { formatStamp, faultTreatmentStatus } from '@/exports/labels';

/**
 * Treatment area (דרג מטפל). Rendered while a בד״ח is IN_TREATMENT. A performer
 * certified for the treating rank (or an admin) assigns the two repair
 * performers, documents the treatment of each transferred section, both repair
 * performers sign, and the treatment is sent back to the approver for final
 * verification. The original inspection, performers and signatures are untouched.
 */
export function TreatmentSection({
  bundle,
  onChanged,
}: {
  bundle: FormBundle;
  onChanged: () => Promise<void>;
}) {
  const { form, tasks, signatures } = bundle;
  const { user } = useAuth();
  const { notify } = useToast();
  const [canTreat, setCanTreat] = useState<boolean | null>(null);
  const [candidates, setCandidates] = useState<Array<{ id: string; full_name: string }>>([]);
  const [p1, setP1] = useState<{ id: string | null; name: string }>({
    id: form.treatment_performer1_id ?? null,
    name: form.treatment_performer1_name ?? '',
  });
  const [p2, setP2] = useState<{ id: string | null; name: string }>({
    id: form.treatment_performer2_id ?? null,
    name: form.treatment_performer2_name ?? '',
  });
  const [reportTaskId, setReportTaskId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const transferred = useMemo(
    () => tasks.filter((t) => t.transferred_for_treatment),
    [tasks]
  );

  useEffect(() => {
    if (!user) return;
    if (isAdmin(user)) {
      setCanTreat(true);
      return;
    }
    isUserCertified(user.id, form.system_id, form.treatment_rank_id ?? null)
      .then(setCanTreat)
      .catch(() => setCanTreat(false));
  }, [user, form.system_id, form.treatment_rank_id]);

  useEffect(() => {
    listTreatmentPerformerCandidates(form)
      .then(setCandidates)
      .catch(() => setCandidates([]));
  }, [form.system_id, form.treatment_rank_id]);

  if (!user) return null;

  const sig1 = signatures.find((s) => s.signer_type === SignerType.REPAIR_PERFORMER);
  const sig2 = signatures.find((s) => s.signer_type === SignerType.REPAIR_PERFORMER2);

  // ---- Not a treating-rank performer: informational lock ----
  if (canTreat === false) {
    return (
      <section className="card border-r-2 border-r-pending-500 p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pending-50 text-pending-600">
            <Icon name="shield-check" size={22} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-ink-900">
              בטיפול {form.treatment_rank_name || 'דרג מטפל'}
            </h2>
            <p className="text-sm text-ink-500">
              הועבר ע״י {form.transferred_by_name} · {formatStamp(form.transferred_at)}
            </p>
          </div>
        </div>
        <p className="max-w-xl text-sm text-ink-500">
          אזור זה נעול עבורך. הטיפול מבוצע ע״י מבצעים המוסמכים ל{form.treatment_rank_name || 'דרג המטפל'}.
        </p>
      </section>
    );
  }

  const persistPerformers = async (
    next1: { id: string | null; name: string },
    next2: { id: string | null; name: string }
  ) => {
    if (!next1.id || !next2.id) return; // need both before saving
    setBusy(true);
    try {
      await setTreatmentPerformers({
        formId: form.id,
        actingUserId: user.id,
        performer1Id: next1.id,
        performer1Name: next1.name,
        performer2Id: next2.id,
        performer2Name: next2.name,
      });
      await onChanged();
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const onPick1 = (sel: { id: string; name: string }) => {
    const next = { id: sel.id, name: sel.name };
    setP1(next);
    persistPerformers(next, p2);
  };
  const onPick2 = (sel: { id: string; name: string }) => {
    const next = { id: sel.id, name: sel.name };
    setP2(next);
    persistPerformers(p1, next);
  };

  const onSubmitReport = async (r: { done: boolean; description: string; image: string | null }) => {
    if (!reportTaskId) return;
    await reportTreatment({
      formId: form.id,
      actingUserId: user.id,
      taskId: reportTaskId,
      ...r,
    });
    notify('הדיווח על הטיפול נשמר', 'ok');
    await onChanged();
  };

  const saveSig = async (type: SignerType, signer: { id: string; full_name: string }, dataUrl: string) => {
    try {
      await addSignature({ formId: form.id, signer, type, signatureData: dataUrl });
      notify('החתימה נשמרה', 'ok');
      await onChanged();
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const submit = async () => {
    const v = await validateTreatmentForApproval(form.id);
    if (!v.ok) {
      notify(v.errors.join(' · '), 'error');
      return;
    }
    setBusy(true);
    try {
      await submitTreatmentForApproval(form.id, user.id);
      notify('הטיפול נשלח לאישור המאשר', 'ok');
      await onChanged();
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const performersChosen = !!form.treatment_performer1_id && !!form.treatment_performer2_id;

  return (
    <section className="card border-r-2 border-r-pending-500 p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pending-50 text-pending-600">
          <Icon name="shield-check" size={22} />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-ink-900">
            טיפול {form.treatment_rank_name || 'דרג מטפל'}
          </h2>
          <p className="text-sm text-ink-500">
            דרג הבדיקה המקורי: <span className="font-semibold">{form.rank_name_snapshot || '—'}</span> ·
            הועבר ע״י {form.transferred_by_name} · {formatStamp(form.transferred_at)}
          </p>
        </div>
      </div>

      {/* Repair performers (distinct from the original performers) */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">מבצע תיקון 1</label>
          <PerformerSelect
            options={candidates}
            value={p1.id}
            valueName={p1.name}
            excludeId={p2.id ?? undefined}
            excludeName={p2.name}
            disabled={busy}
            onChange={onPick1}
          />
        </div>
        <div>
          <label className="label">מבצע תיקון 2</label>
          <PerformerSelect
            options={candidates}
            value={p2.id}
            valueName={p2.name}
            excludeId={p1.id ?? undefined}
            excludeName={p1.name}
            disabled={busy}
            onChange={onPick2}
          />
        </div>
      </div>

      {/* Transferred sections — document the treatment of each */}
      <div className="space-y-2">
        <div className="text-[13px] font-semibold text-ink-700">סעיפים שהועברו לטיפול</div>
        {transferred.map((t) => (
          <div key={t.id} className="rounded-lg border border-pending-200 bg-pending-50/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink-900">
                  {t.part_name_snapshot} · {t.action_snapshot}
                </div>
                <div className="text-[12.5px] font-medium text-pending-700">
                  {faultTreatmentStatus(t)}
                </div>
              </div>
              <button
                type="button"
                className="btn-primary btn-sm gap-1.5"
                disabled={!performersChosen}
                onClick={() => setReportTaskId(t.id)}
                title={!performersChosen ? 'יש לבחור תחילה שני מבצעי תיקון' : undefined}
              >
                <Icon name="clipboard-check" size={15} />
                {t.repair_reported ? 'עדכן דיווח טיפול' : 'דווח על ביצוע טיפול'}
              </button>
            </div>
            {t.comment.trim() && (
              <div className="mt-1 text-[13px] text-ink-700">
                <span className="font-semibold text-fault-700">התקלה: </span>
                {t.comment}
              </div>
            )}
            {t.transfer_section_note && (
              <div className="mt-1 rounded-md border border-pending-200 bg-white px-3 py-1.5 text-[13px] text-ink-800">
                <span className="font-semibold text-pending-700">הערת המאשר: </span>
                {t.transfer_section_note}
              </div>
            )}
            {t.repair_reported && (
              <div className="mt-1 text-[13px] text-ink-700">
                <span className="font-semibold text-brand-700">טיפול שבוצע: </span>
                {t.repair_done
                  ? t.repair_description || '—'
                  : 'לא תוקן' + (t.repair_description ? ` — ${t.repair_description}` : '')}
                {t.repaired_by_name && (
                  <span className="text-ink-500">
                    {' '}· {t.repaired_by_name} · {formatStamp(t.repaired_at)}
                  </span>
                )}
                {t.repair_image && (
                  <button type="button" className="mr-2 align-middle" onClick={() => setLightbox(t.repair_image!)}>
                    <img
                      src={t.repair_image}
                      alt="לאחר טיפול"
                      className="inline h-9 w-9 rounded border border-slate-200 object-cover"
                    />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Repair-performer signatures (new; original performers' signatures kept) */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TreatmentSignature
          title="חתימת מבצע תיקון 1"
          signerName={form.treatment_performer1_name || ''}
          existing={sig1?.signature_data}
          existingName={sig1?.signer_name}
          existingAt={sig1?.signed_at}
          disabled={!form.treatment_performer1_id}
          disabledHint={!form.treatment_performer1_id ? 'יש לבחור מבצע תיקון 1' : undefined}
          onSave={(d) =>
            saveSig(
              SignerType.REPAIR_PERFORMER,
              { id: form.treatment_performer1_id ?? '', full_name: form.treatment_performer1_name ?? '' },
              d
            )
          }
          notify={notify}
        />
        <TreatmentSignature
          title="חתימת מבצע תיקון 2"
          signerName={form.treatment_performer2_name || ''}
          existing={sig2?.signature_data}
          existingName={sig2?.signer_name}
          existingAt={sig2?.signed_at}
          disabled={!form.treatment_performer2_id}
          disabledHint={!form.treatment_performer2_id ? 'יש לבחור מבצע תיקון 2' : undefined}
          onSave={(d) =>
            saveSig(
              SignerType.REPAIR_PERFORMER2,
              { id: form.treatment_performer2_id ?? '', full_name: form.treatment_performer2_name ?? '' },
              d
            )
          }
          notify={notify}
        />
      </div>

      <div className="mt-5">
        <button className="btn-primary btn-lg gap-2" onClick={submit} disabled={busy}>
          <Icon name="arrow-start" size={18} /> שלח טיפול לאישור
        </button>
      </div>

      <RepairModal
        open={!!reportTaskId}
        task={transferred.find((t) => t.id === reportTaskId) ?? null}
        onClose={() => setReportTaskId(null)}
        onSubmit={onSubmitReport}
        onViewImage={(src) => setLightbox(src)}
        notifyError={(m) => notify(m, 'error')}
      />

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-6"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-h-[85vh] max-w-full rounded-lg" />
        </div>
      )}
    </section>
  );
}

function TreatmentSignature({
  title,
  signerName,
  existing,
  existingName,
  existingAt,
  disabled,
  disabledHint,
  onSave,
  notify,
}: {
  title: string;
  signerName: string;
  existing?: string;
  existingName?: string;
  existingAt?: string;
  disabled?: boolean;
  disabledHint?: string;
  onSave: (dataUrl: string) => Promise<void>;
  notify: (m: string, k?: 'ok' | 'error' | 'info') => void;
}) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [empty, setEmpty] = useState(true);
  const [resign, setResign] = useState(false);
  const showPad = !disabled && (!existing || resign);

  const save = async () => {
    if (!padRef.current || padRef.current.isEmpty()) {
      notify('יש לחתום לפני השמירה', 'error');
      return;
    }
    await onSave(padRef.current.toDataURL());
    setResign(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink-700">{title}</span>
        <span className="text-[13px] text-ink-500">{signerName || '—'}</span>
      </div>
      {existing && !resign ? (
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ok-600">
            <Icon name="check" size={15} /> נחתם
          </div>
          <img src={existing} alt="חתימה" className="max-h-32 rounded border border-slate-200 bg-white" />
          <div className="mt-2 text-[12.5px] text-ink-500">
            {existingName} · {formatStamp(existingAt)}
          </div>
          <button className="btn-secondary btn-sm mt-3 gap-1.5" onClick={() => setResign(true)}>
            <Icon name="refresh" size={15} /> חתום מחדש
          </button>
        </div>
      ) : showPad ? (
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
  );
}
