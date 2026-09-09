import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canApprove, canPerform, isAdmin } from '@/services/rbac';
import {
  getUserSummary,
  listDrafts,
  listFormsByPerformer,
  listPendingApproval,
  type UserFormSummary,
} from '@/services/forms';
import { Icon, type IconName } from '@/components/Icon';
import type { CompletedForm } from '@/types';
import { formatDate } from '@/exports/labels';

function StatCell({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'pending' | 'fault' | 'ok';
}) {
  const numColor =
    tone === 'pending'
      ? 'text-pending-600'
      : tone === 'fault'
        ? 'text-fault-600'
        : tone === 'ok'
          ? 'text-ok-600'
          : 'text-navy-800';
  return (
    <div className="card px-4 py-3.5">
      <div className={`nums text-[26px] font-extrabold leading-none ${numColor}`}>{value}</div>
      <div className="mt-1.5 text-[13px] font-medium text-ink-500">{label}</div>
    </div>
  );
}

function ActionRow({
  to,
  title,
  desc,
  icon,
  count,
}: {
  to: string;
  title: string;
  desc: string;
  icon: IconName;
  count?: number;
}) {
  return (
    <Link
      to={to}
      className="card group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:border-slate-300 hover:bg-slate-50/60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-ink-600">
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold text-ink-900">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="nums rounded-full bg-pending-100 px-1.5 py-0.5 text-[11px] font-bold text-pending-700">
              {count}
            </span>
          )}
        </div>
        <div className="truncate text-[13px] text-ink-500">{desc}</div>
      </div>
      <Icon
        name="chevron-start"
        size={16}
        className="text-ink-300 transition-colors group-hover:text-brand-600"
      />
    </Link>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<CompletedForm[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [summary, setSummary] = useState<UserFormSummary | null>(null);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    listDrafts(user.id).then(setDrafts).catch(() => {});
    getUserSummary(user.id).then(setSummary).catch(() => {});
    const today = new Date().toISOString().slice(0, 10);
    listFormsByPerformer(user.id)
      .then((forms) => setTodayCount(forms.filter((f) => f.created_at.slice(0, 10) === today).length))
      .catch(() => {});
    if (canApprove(user)) {
      listPendingApproval().then((p) => setPendingCount(p.length)).catch(() => {});
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="pt-1">
        <div className="text-[15px] font-medium text-ink-500">שלום, {user.full_name}</div>
        <h1 className="mt-0.5 text-[24px] font-extrabold text-navy-900">מערכת בד״ח דיגיטלית</h1>
      </div>

      {/* Compact stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCell label="בד״חים פתוחים" value={drafts.length} />
        <StatCell
          label="ממתינים לאישור"
          value={canApprove(user) ? pendingCount : (summary?.pending ?? 0)}
          tone="pending"
        />
        <StatCell label="בוצעו היום" value={todayCount} />
        <StatCell label="עם תקלות" value={summary?.withFaults ?? 0} tone="fault" />
      </div>

      {/* Resume draft */}
      {drafts.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-r-2 border-r-pending-500 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-pending-50 text-pending-600">
              <Icon name="pen" size={18} />
            </span>
            <div>
              <div className="text-[14px] font-bold text-ink-900">בד״ח שלא הושלם</div>
              <div className="text-[13px] text-ink-500">
                {drafts[0].name} · {formatDate(drafts[0].date)}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={() => navigate(`/form/${drafts[0].id}`)}>
              המשך בד״ח
            </button>
            {drafts.length > 1 && (
              <Link to="/my" className="btn-secondary btn-sm">
                עוד {drafts.length - 1} טיוטות
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <div className="eyebrow">פעולות</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {canPerform(user) && (
            <ActionRow
              to="/new"
              title="בד״ח חדש"
              desc="פתיחת בדיקה חדשה מתוך בד״ח מפורסם"
              icon="plus"
            />
          )}
          <ActionRow
            to="/my"
            title="הבד״חים שלי"
            desc="טיוטות, ממתינים לאישור ומאושרים"
            icon="clipboard-check"
          />
          {canApprove(user) && (
            <ActionRow
              to="/pending"
              title="ממתינים לאישור"
              desc="בד״חים הממתינים לחתימת מאשר"
              icon="clock"
              count={pendingCount}
            />
          )}
          <ActionRow
            to="/history"
            title="היסטוריית בד״חים"
            desc="חיפוש, צפייה והפקת דוחות"
            icon="history"
          />
          {isAdmin(user) && (
            <>
              <ActionRow
                to="/admin/templates"
                title="ניהול בד״חים"
                desc="יצירה, עריכה ופרסום בד״חים"
                icon="layers"
              />
              <ActionRow
                to="/admin/users"
                title="ניהול משתמשים"
                desc="משתמשים, הרשאות ואיפוס סיסמאות"
                icon="users"
              />
              <ActionRow
                to="/admin"
                title="לוח ניהול"
                desc="דשבורד, הגדרות, גיבוי ויומן ביקורת"
                icon="settings"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
