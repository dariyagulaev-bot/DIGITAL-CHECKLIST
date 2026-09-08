import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { getFormBundle, type FormBundle } from '@/services/forms';
import { exportFormToExcel } from '@/exports/excel';
import { elementToPdf } from '@/exports/pdf';
import { Spinner } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { formatDate, formatDateTime, statusLabel } from '@/exports/labels';
import { FormStatus, SignerType, TaskResult, type Signature } from '@/types';

export default function FormViewPage() {
  const { id } = useParams<{ id: string }>();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<FormBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPdf, setBusyPdf] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    getFormBundle(id).then((b) => {
      setBundle(b);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Spinner label="טוען…" />;
  if (!bundle) return <div className="p-6">הבד״ח לא נמצא.</div>;

  const { form, tasks, signatures } = bundle;
  const approved = form.status === FormStatus.APPROVED;
  const perf = signatures.find((s) => s.signer_type === SignerType.PERFORMER);
  const appr = signatures.find((s) => s.signer_type === SignerType.APPROVER);
  const faults = tasks.filter((t) => t.result === TaskResult.FAULT && t.fault_image);
  const okCount = tasks.filter((t) => t.result === TaskResult.OK).length;
  const faultCount = tasks.filter((t) => t.result === TaskResult.FAULT).length;

  const doPdf = async () => {
    if (!docRef.current) return;
    setBusyPdf(true);
    try {
      await elementToPdf(docRef.current, `badach_${form.name}_${form.date}.pdf`);
      notify('קובץ PDF נוצר', 'ok');
    } catch (e) {
      notify('יצירת ה-PDF נכשלה: ' + (e as Error).message, 'error');
    } finally {
      setBusyPdf(false);
    }
  };

  const doExcel = async () => {
    try {
      await exportFormToExcel(form.id);
      notify('קובץ Excel נוצר', 'ok');
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  return (
    <div className="min-h-full bg-slate-200 py-6">
      {/* Toolbar */}
      <div className="no-print mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4">
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => navigate(-1)}>
            ← חזרה
          </button>
          <Link to="/" className="btn-ghost">
            דף הבית
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={() => window.print()}>
            🖨️ הדפס
          </button>
          <button className="btn-outline" onClick={doPdf} disabled={busyPdf}>
            {busyPdf ? 'יוצר PDF…' : '📄 PDF'}
          </button>
          <button className="btn-outline" onClick={doExcel}>
            📊 Excel
          </button>
        </div>
      </div>

      {/* A4 document */}
      <div
        ref={docRef}
        className="print-page mx-auto max-w-4xl bg-white p-8 shadow-soft"
        style={{ width: '210mm', maxWidth: '100%' }}
      >
        {/* Status banner */}
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-center text-lg font-bold ${
            approved ? 'bg-ok-100 text-ok-700' : 'bg-pending-100 text-pending-700'
          }`}
        >
          סטטוס הבד״ח: {statusLabel(form.status)}
          {approved ? ' 🔒' : ' — טרם אושר'}
        </div>

        {/* Header */}
        <div className="mb-4 border-b-2 border-slate-800 pb-3">
          <h1 className="text-2xl font-bold text-slate-900">{form.name}</h1>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-700 sm:grid-cols-3">
            <div>
              <span className="font-semibold">מספר: </span>
              {form.number || '—'}
            </div>
            <div>
              <span className="font-semibold">תאריך: </span>
              {formatDate(form.date)}
            </div>
            <div>
              <span className="font-semibold">סטטוס: </span>
              {statusLabel(form.status)}
            </div>
            <div>
              <span className="font-semibold">מבצע: </span>
              {form.performer_name}
            </div>
            <div>
              <span className="font-semibold">מאשר: </span>
              {form.approver_name || '—'}
            </div>
          </div>
        </div>

        {/* Tasks table */}
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="border border-slate-300 p-2">שם החלק</th>
              <th className="border border-slate-300 p-2">הפעולה</th>
              <th className="border border-slate-300 p-2">ציוד</th>
              <th className="border border-slate-300 p-2 text-center">תקין</th>
              <th className="border border-slate-300 p-2 text-center">לא תקין</th>
              <th className="border border-slate-300 p-2">הערות</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const isOk = t.result === TaskResult.OK;
              const isFault = t.result === TaskResult.FAULT;
              return (
                <tr key={t.id} className={isFault ? 'bg-fault-50' : ''}>
                  <td className="border border-slate-300 p-2 font-medium">{t.part_name_snapshot}</td>
                  <td className="border border-slate-300 p-2">{t.action_snapshot}</td>
                  <td className="border border-slate-300 p-2">{t.equipment_snapshot || 'ללא'}</td>
                  <td className="border border-slate-300 p-2 text-center text-lg font-bold text-ok-600">
                    {isOk ? '✓' : ''}
                  </td>
                  <td className="border border-slate-300 p-2 text-center text-lg font-bold text-fault-600">
                    {isFault ? '✕' : ''}
                  </td>
                  <td className="border border-slate-300 p-2 text-slate-600">{t.comment || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
          <span>סה״כ בדיקות: {tasks.length}</span>
          <span className="text-ok-600">תקין: {okCount}</span>
          <span className="text-fault-600">לא תקין: {faultCount}</span>
        </div>

        {/* Fault images */}
        {faults.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 font-bold text-slate-800">תמונות תקלות</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {faults.map((t) => (
                <div key={t.id} className="rounded-lg border border-slate-200 p-2">
                  <img src={t.fault_image!} alt="" className="h-32 w-full rounded object-cover" />
                  <div className="mt-1 text-xs text-slate-600">{t.part_name_snapshot}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-2 gap-6">
          <SignatureBlock title="מבצע הבדיקה" sig={perf} />
          <SignatureBlock title="מאשר הבדיקה" sig={appr} />
        </div>
      </div>
    </div>
  );
}

function SignatureBlock({ title, sig }: { title: string; sig: Signature | undefined }) {
  return (
    <div className="rounded-lg border border-slate-300 p-3">
      <div className="mb-2 border-b border-slate-200 pb-1 text-center font-bold text-slate-800">
        {title}
      </div>
      {sig ? (
        <>
          <div className="text-sm text-slate-700">
            <span className="font-semibold">שם: </span>
            {sig.signer_name}
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-semibold">תפקיד/מספר: </span>
            {sig.signer_role || '—'}
          </div>
          <div className="my-2 flex h-24 items-center justify-center rounded bg-slate-50">
            <img src={sig.signature_data} alt="חתימה" className="max-h-24" />
          </div>
          <div className="text-xs text-slate-500">
            תאריך: {formatDate(sig.signed_at)} · שעה: {formatDateTime(sig.signed_at).split(', ')[1] ?? ''}
          </div>
        </>
      ) : (
        <div className="flex h-32 items-center justify-center text-slate-400">טרם נחתם</div>
      )}
    </div>
  );
}
