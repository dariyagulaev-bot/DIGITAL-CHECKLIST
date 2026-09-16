import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDashboardStats,
  getDashboardBreakdowns,
  type DashboardStats,
  type DashboardBreakdowns,
  type BreakdownRow,
} from '@/services/forms';
import { Spinner } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { formatDate } from '@/exports/labels';

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card p-4">
      <div className={`text-[30px] font-bold leading-none ${accent}`}>{value}</div>
      <div className="mt-1.5 text-[13px] text-ink-500">{label}</div>
    </div>
  );
}

/** Horizontal bar list — the workhorse breakdown chart, on brand. */
function BarList({
  title,
  icon,
  rows,
  empty = 'אין נתונים',
  barClass = 'bg-brand-500',
}: {
  title: string;
  icon: IconName;
  rows: BreakdownRow[];
  empty?: string;
  barClass?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-ink-600">
          <Icon name={icon} size={16} />
        </span>
        <h3 className="text-[14px] font-bold text-ink-800">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-center text-[13px] text-ink-400">{empty}</div>
      ) : (
        <div className="space-y-2.5">
          {rows.slice(0, 8).map((r) => (
            <div key={r.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate font-medium text-ink-700">{r.label}</span>
                <span className="nums shrink-0 text-ink-500">
                  {r.total}
                  {r.faults > 0 && <span className="text-fault-600"> · {r.faults} תקלות</span>}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${barClass}`}
                  style={{ width: `${Math.round((r.total / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Monthly volume — compact vertical bars for the last months. */
function MonthlyChart({ rows }: { rows: BreakdownRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-ink-600">
          <Icon name="history" size={16} />
        </span>
        <h3 className="text-[14px] font-bold text-ink-800">נפח בד״חים לפי חודש</h3>
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-center text-[13px] text-ink-400">אין נתונים</div>
      ) : (
        <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
          {rows.map((r) => (
            <div key={r.key} className="flex flex-1 flex-col items-center justify-end gap-2">
              <span className="nums text-[12px] font-semibold text-ink-600">{r.total}</span>
              <div
                className="w-full max-w-[42px] rounded-t bg-brand-500"
                style={{ height: `${Math.max(4, Math.round((r.total / max) * 104))}px` }}
              />
              <span className="nums text-[11px] text-ink-400">{r.label.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** OK vs Fault proportion across all inspected items. */
function OkFaultBar({ ok, fault }: { ok: number; fault: number }) {
  const total = ok + fault;
  const okPct = total ? Math.round((ok / total) * 100) : 0;
  const faultPct = total ? 100 - okPct : 0;
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-ink-600">
          <Icon name="shield-check" size={16} />
        </span>
        <h3 className="text-[14px] font-bold text-ink-800">תקין מול לא תקין (סעיפים)</h3>
      </div>
      {total === 0 ? (
        <div className="py-6 text-center text-[13px] text-ink-400">אין נתונים</div>
      ) : (
        <>
          <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-ok-500" style={{ width: `${okPct}%` }} />
            <div className="h-full bg-fault-500" style={{ width: `${faultPct}%` }} />
          </div>
          <div className="mt-3 flex justify-between text-[13px]">
            <span className="flex items-center gap-1.5 font-semibold text-ok-600">
              <span className="h-2.5 w-2.5 rounded-full bg-ok-500" /> תקין {ok} ({okPct}%)
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-fault-600">
              <span className="h-2.5 w-2.5 rounded-full bg-fault-500" /> לא תקין {fault} ({faultPct}%)
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [breakdowns, setBreakdowns] = useState<DashboardBreakdowns | null>(null);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => {});
    getDashboardBreakdowns().then(setBreakdowns).catch(() => {});
  }, []);

  if (!stats || !breakdowns) return <Spinner />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[16px] font-bold text-ink-900">לוח בקרה</h2>
        <p className="text-[13px] text-ink-500">תמונת מצב של הבד״חים לפי היררכיית המערכות.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="סה״כ בד״חים" value={breakdowns.totalForms} accent="text-ink-800" />
        <Stat label="בד״חים היום" value={stats.today} accent="text-brand-600" />
        <Stat label="החודש" value={stats.month} accent="text-ink-700" />
        <Stat label="מאושרים" value={stats.approved} accent="text-ok-600" />
        <Stat label="ממתינים לאישור" value={stats.pending} accent="text-pending-600" />
        <Stat label="עם תקלות" value={stats.withFaults} accent="text-fault-600" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MonthlyChart rows={breakdowns.byMonth} />
        <OkFaultBar ok={breakdowns.okItems} fault={breakdowns.faultItems} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <BarList title="לפי סוג מערכת" icon="database" rows={breakdowns.bySystem} />
        <BarList title="לפי מספר מערכת" icon="layers" rows={breakdowns.byUnit} />
        <BarList title="לפי דרג בדיקה" icon="shield-check" rows={breakdowns.byRank} />
        <BarList title="לפי מבצע" icon="users" rows={breakdowns.byPerformer} />
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-[15px] font-bold text-ink-800">בד״חים הממתינים לאישור</h2>
        {stats.recentPending.length === 0 ? (
          <div className="py-6 text-center text-ink-400">אין בד״חים הממתינים לאישור</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {stats.recentPending.map((f) => (
              <Link
                key={f.id}
                to={`/view/${f.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink-800">{f.name}</div>
                  <div className="text-[13px] text-ink-500">
                    {f.system_name_snapshot ? `${f.system_name_snapshot} · ` : ''}
                    מבצע: {f.performer_name} · {formatDate(f.date)}
                  </div>
                </div>
                <span className="badge border-pending-200 bg-pending-50 text-pending-700">ממתין</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
