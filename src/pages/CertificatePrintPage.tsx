import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { CertificateView } from '@/components/CertificateView';
import { CertificateSheet, ScaledSheet } from '@/components/CertificateCanvasView';
import { getCertificate, certificateFieldData } from '@/services/certificates';
import { elementToPdf } from '@/exports/pdf';
import { useToast } from '@/context/ToastContext';
import type { Certificate } from '@/types';

/**
 * Printable certificate. Renders the FROZEN snapshot (design + data captured at
 * issuance), so reprinting reproduces the original exactly. For the A4 canvas
 * design, the on-screen preview, the printed page and the exported PDF all come
 * from the SAME real-millimetre sheet, so layout never shifts between them.
 */
export default function CertificatePrintPage() {
  const { id } = useParams();
  const { notify } = useToast();
  const [cert, setCert] = useState<Certificate | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    getCertificate(id)
      .then((c) => setCert(c ?? null))
      .catch(() => setCert(null));
  }, [id]);

  if (cert === undefined) return <Spinner label="טוען תעודה…" />;
  if (cert === null)
    return (
      <div className="card p-8 text-center text-ink-500">
        התעודה לא נמצאה.
        <div className="mt-3">
          <Link to="/certificates" className="link">
            חזרה לרשימת התעודות
          </Link>
        </div>
      </div>
    );

  const data = certificateFieldData(cert);
  const isCanvas = 'kind' in cert.design_snapshot && cert.design_snapshot.kind === 'canvas';

  const exportPdf = async () => {
    if (!sheetRef.current) return;
    setBusy(true);
    try {
      await elementToPdf(sheetRef.current, `${cert.number}.pdf`);
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="print:bg-white">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[14px] text-ink-500">
          תעודה מס׳ <b className="text-ink-800">{cert.number}</b>
          {cert.template_version ? ` · תבנית ${cert.template_version}` : ''} · הופקה{' '}
          {cert.created_at.slice(0, 10)}
        </div>
        <div className="flex gap-2">
          <Link to="/certificates" className="btn-ghost btn-sm">
            לרשימה
          </Link>
          {isCanvas && (
            <button className="btn-secondary btn-sm gap-1.5" onClick={exportPdf} disabled={busy}>
              <Icon name="download" size={16} /> ייצא PDF
            </button>
          )}
          <button className="btn-primary btn-sm gap-1.5" onClick={() => window.print()}>
            <Icon name="printer" size={16} /> הדפס
          </button>
        </div>
      </div>

      {isCanvas ? (
        <>
          {/* On-screen preview (scaled to fit) */}
          <div className="no-print rounded-xl bg-slate-100 p-4">
            <ScaledSheet
              design={cert.design_snapshot as never}
              data={data}
              signatureData={cert.signature_data}
              maxWidthPx={620}
            />
          </div>
          {/* Real-mm A4 sheet: off-screen on display (so html2canvas can capture
              it for PDF), promoted to a normal A4 page when printing. */}
          <div className="cert-print-sheet">
            <CertificateSheet
              ref={sheetRef}
              design={cert.design_snapshot as never}
              data={data}
              signatureData={cert.signature_data}
            />
          </div>
        </>
      ) : (
        <div className="print-page">
          <CertificateView design={cert.design_snapshot} data={data} signatureData={cert.signature_data} />
        </div>
      )}
    </div>
  );
}
