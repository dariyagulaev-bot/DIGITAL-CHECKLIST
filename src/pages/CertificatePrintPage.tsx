import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { CertificateView } from '@/components/CertificateView';
import { getCertificate, certificateFieldData } from '@/services/certificates';
import type { Certificate } from '@/types';

/**
 * Printable certificate. Renders the FROZEN snapshot (design + data captured at
 * issuance), so reprinting an old certificate reproduces the original exactly —
 * never the current template. Offline print via the browser (window.print()).
 */
export default function CertificatePrintPage() {
  const { id } = useParams();
  const [cert, setCert] = useState<Certificate | null | undefined>(undefined);

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

  return (
    <div className="print:bg-white">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[14px] text-ink-500">
          תעודה מס׳ <b className="text-ink-800">{cert.number}</b> · הופקה{' '}
          {cert.created_at.slice(0, 10)}
        </div>
        <div className="flex gap-2">
          <Link to="/certificates" className="btn-ghost btn-sm">
            לרשימה
          </Link>
          <button className="btn-primary btn-sm gap-1.5" onClick={() => window.print()}>
            <Icon name="printer" size={16} /> הדפס / שמור PDF
          </button>
        </div>
      </div>

      <div className="print-page">
        <CertificateView
          design={cert.design_snapshot}
          data={certificateFieldData(cert)}
          signatureData={cert.signature_data}
        />
      </div>
    </div>
  );
}
