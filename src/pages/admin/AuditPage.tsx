import { useEffect, useState } from 'react';
import { listAudit } from '@/services/audit';
import { Spinner, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/exports/labels';
import type { AuditEntry } from '@/types';

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    listAudit().then(setEntries).catch(() => setEntries([]));
  }, []);

  if (entries === null) return <Spinner />;
  if (entries.length === 0)
    return <EmptyState icon="file" title="יומן הביקורת ריק" hint="פעולות חריגות יירשמו כאן" />;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[820px] text-right text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <th className="p-3">תאריך ושעה</th>
            <th className="p-3">משתמש</th>
            <th className="p-3">פעולה</th>
            <th className="p-3">ישות</th>
            <th className="p-3">שדה</th>
            <th className="p-3">ערך קודם</th>
            <th className="p-3">ערך חדש</th>
            <th className="p-3">סיבה</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-slate-100">
              <td className="p-3 whitespace-nowrap">{formatDateTime(e.timestamp)}</td>
              <td className="p-3">{e.user_name}</td>
              <td className="p-3 font-medium text-slate-700">{e.action}</td>
              <td className="p-3 text-slate-500">{e.entity_type}</td>
              <td className="p-3">{e.field || '—'}</td>
              <td className="p-3 text-slate-500">{e.old_value ?? '—'}</td>
              <td className="p-3 text-slate-500">{e.new_value ?? '—'}</td>
              <td className="p-3 text-slate-500">{e.reason || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
