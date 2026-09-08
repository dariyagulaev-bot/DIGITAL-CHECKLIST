import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats, type DashboardStats } from '@/services/forms';
import { Spinner } from '@/components/ui';
import { formatDate } from '@/exports/labels';

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card p-5 text-center">
      <div className={`text-4xl font-bold ${accent}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => {});
  }, []);

  if (!stats) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="בד״חים היום" value={stats.today} accent="text-brand-600" />
        <Stat label="החודש" value={stats.month} accent="text-slate-700" />
        <Stat label="מאושרים" value={stats.approved} accent="text-ok-600" />
        <Stat label="ממתינים לאישור" value={stats.pending} accent="text-pending-600" />
        <Stat label="עם תקלות" value={stats.withFaults} accent="text-fault-600" />
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-lg font-bold text-slate-700">בד״חים הממתינים לאישור</h2>
        {stats.recentPending.length === 0 ? (
          <div className="py-6 text-center text-slate-400">אין בד״חים הממתינים לאישור</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {stats.recentPending.map((f) => (
              <Link
                key={f.id}
                to={`/view/${f.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"
              >
                <div>
                  <div className="font-semibold text-slate-800">{f.name}</div>
                  <div className="text-sm text-slate-500">
                    מבצע: {f.performer_name} · {formatDate(f.date)}
                  </div>
                </div>
                <span className="badge bg-pending-100 text-pending-700">ממתין</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
