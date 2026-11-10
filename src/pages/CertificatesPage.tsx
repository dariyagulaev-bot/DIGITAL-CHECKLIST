import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/Layout';
import { Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { listCertificates } from '@/services/certificates';
import { formatDateDots } from '@/exports/labels';
import type { Certificate } from '@/types';

/**
 * Issued-certificate history. Each row reprints the ORIGINAL frozen snapshot.
 * Historical certificates are never altered when templates or data change later.
 */
export default function CertificatesPage() {
  const [certs, setCerts] = useState<Certificate[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    listCertificates().then(setCerts).catch(() => setCerts([]));
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t || !certs) return certs ?? [];
    return certs.filter((c) =>
      [c.number, c.user_name_snapshot, c.system_name_snapshot, c.rank_name_snapshot]
        .join(' ')
        .includes(t)
    );
  }, [certs, q]);

  return (
    <div>
      <PageHeader title="תעודות הסמכה" subtitle="היסטוריית התעודות שהונפקו — צפייה והדפסה חוזרת." />

      <div className="mb-4">
        <input
          className="input max-w-sm"
          placeholder="חיפוש לפי שם, מערכת, דרג או מספר תעודה…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {certs === null ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-ink-500">לא הונפקו תעודות עדיין.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[720px]">
            <thead>
              <tr>
                <th>מספר תעודה</th>
                <th>עובד</th>
                <th>מערכת / דרג</th>
                <th>סוג</th>
                <th>תוקף עד</th>
                <th>הונפקה</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="row-hover">
                  <td className="nums font-semibold text-ink-900">{c.number}</td>
                  <td>{c.user_name_snapshot}</td>
                  <td>
                    {c.system_name_snapshot} / {c.rank_name_snapshot}
                  </td>
                  <td>{c.action_type === 'renewal' ? 'רענון' : 'ראשונית'}</td>
                  <td className="nums">{formatDateDots(c.expires_at)}</td>
                  <td className="nums">{formatDateDots(c.created_at.slice(0, 10))}</td>
                  <td>
                    <Link to={`/certificate/${c.id}`} className="link inline-flex items-center gap-1">
                      <Icon name="printer" size={15} /> צפה / הדפס
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
