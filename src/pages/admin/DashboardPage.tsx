import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDashboardStats,
  getDashboardBreakdowns,
  type DashboardStats,
  type DashboardBreakdowns,
  type DashboardFilter,
  type BreakdownRow,
} from '@/services/forms';
import { listSystems } from '@/services/systems';
import { listUnits } from '@/services/units';
import { listRanks } from '@/services/ranks';
import { listTemplates } from '@/services/templates';
import type { Rank, System, Template, Unit } from '@/types';
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

/** Compact severity stat card. */
function SevStat({ label, value, accent, hint }: { label: string; value: number; accent: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className={`text-[26px] font-bold leading-none ${accent}`}>{value}</div>
      <div className="mt-1.5 text-[13px] font-medium text-ink-600">{label}</div>
      {hint && <div className="text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [breakdowns, setBreakdowns] = useState<DashboardBreakdowns | null>(null);
  // Severity view — independently filtered breakdown (system / unit / rank / type / dates).
  const [sev, setSev] = useState<DashboardBreakdowns | null>(null);
  const [filter, setFilter] = useState<DashboardFilter>({});
  const [systems, setSystems] = useState<System[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => {});
    getDashboardBreakdowns().then(setBreakdowns).catch(() => {});
    listSystems(true).then(setSystems).catch(() => {});
    listUnits(true).then(setUnits).catch(() => {});
    listRanks(true).then(setRanks).catch(() => {});
    listTemplates(true).then(setTemplates).catch(() => {});
  }, []);

  // Re-aggregate the severity view whenever the filter changes.
  useEffect(() => {
    getDashboardBreakdowns(filter).then(setSev).catch(() => {});
  }, [filter]);

  // Units shown in the filter follow the chosen system (מספר מערכת belongs to a סוג מערכת).
  const filterUnits = useMemo(
    () => units.filter((u) => !filter.systemId || u.system_id === filter.systemId),
    [units, filter.systemId]
  );
  const set = (patch: Partial<DashboardFilter>) => setFilter((f) => ({ ...f, ...patch }));

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

      {/* Fault severity (חומרת תקלות) — with filters by system / unit / rank / type / dates. */}
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-ink-600">
            <Icon name="alert" size={16} />
          </span>
          <h3 className="text-[14px] font-bold text-ink-800">חומרת תקלות</h3>
        </div>
        {/* Filter bar */}
        <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <select className="input !min-h-0 !py-1.5 text-[13px]" value={filter.systemId ?? ''} onChange={(e) => set({ systemId: e.target.value || undefined, unitId: undefined })}>
            <option value="">כל המערכות</option>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input !min-h-0 !py-1.5 text-[13px]" value={filter.unitId ?? ''} onChange={(e) => set({ unitId: e.target.value || undefined })}>
            <option value="">כל מספרי המערכת</option>
            {filterUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="input !min-h-0 !py-1.5 text-[13px]" value={filter.rankId ?? ''} onChange={(e) => set({ rankId: e.target.value || undefined })}>
            <option value="">כל הדרגים</option>
            {ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="input !min-h-0 !py-1.5 text-[13px]" value={filter.templateId ?? ''} onChange={(e) => set({ templateId: e.target.value || undefined })}>
            <option value="">כל סוגי הבדיקה</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input type="date" className="input !min-h-0 !py-1.5 text-[13px]" value={filter.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} title="מתאריך" />
          <input type="date" className="input !min-h-0 !py-1.5 text-[13px]" value={filter.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} title="עד תאריך" />
        </div>
        {(() => {
          const s = (sev ?? breakdowns).severity;
          return (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <SevStat label="תקלות קלות" value={s.light} accent="text-ok-600" />
              <SevStat label="תקלות בינוניות" value={s.medium} accent="text-pending-600" />
              <SevStat label="תקלות חמורות/משביתות" value={s.severe} accent="text-fault-600" />
              <SevStat label="משביתות פתוחות" value={s.severeOpen} accent="text-fault-700" hint="טרם תוקנו ואומתו" />
              <SevStat label="משביתות שתוקנו" value={s.severeRepaired} accent="text-ok-600" hint="תוקנו ואומתו" />
            </div>
          );
        })()}
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
