import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canApprove, canPerform, isAdmin } from '@/services/rbac';
import {
  getUserSummary,
  listDrafts,
  listPendingApproval,
  type UserFormSummary,
} from '@/services/forms';
import { Icon, type IconName } from '@/components/Icon';
import type { CompletedForm } from '@/types';
import { formatDate } from '@/exports/labels';

type Tone = 'brand' | 'pending' | 'accent' | 'ok' | 'neutral';
const TONE_TILE: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  pending: 'bg-pending-50 text-pending-600',
  accent: 'bg-accent-50 text-accent-600',
  ok: 'bg-ok-50 text-ok-600',
  neutral: 'bg-slate-100 text-slate-500',
};

function ActionCard({
  to,
  title,
  desc,
  icon,
  tone,
  count,
}: {
  to: string;
  title: string;
  desc: string;
  icon: IconName;
  tone: Tone;
  count?: number;
}) {
  return (
    <Link to={to} className="card hoverable group relative flex flex-col p-5">
      <div className="mb-4 flex items-start justify-between">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${TONE_TILE[tone]} transition-transform group-hover:scale-105`}
        >
          <Icon name={icon} size={24} />
        </span>
        {count !== undefined && count > 0 && (
          <span className="nums rounded-full bg-pending-500 px-2.5 py-1 text-sm font-extrabold text-white shadow-soft">
            {count}
          </span>
        )}
      </div>
      <div className="text-[17px] font-extrabold text-ink-900">{title}</div>
      <div className="mt-1 flex-1 text-sm leading-relaxed text-slate-500">{desc}</div>
      <div className="mt-4 flex items-center gap-1 text-sm font-bold text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
        פתיחה
        <Icon name="chevron-start" size={16} />
      </div>
    </Link>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: IconName }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-accent-400">
        <Icon name={icon} size={20} />
      </span>
      <div className="leading-tight">
        <div className="nums font-display text-2xl font-extrabold text-white">{value}</div>
        <div className="text-xs font-semibold text-ink-200">{label}</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<CompletedForm[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [summary, setSummary] = useState<UserFormSummary | null>(null);

  useEffect(() => {
    if (!user) return;
    listDrafts(user.id).then(setDrafts).catch(() => {});
    getUserSummary(user.id).then(setSummary).catch(() => {});
    if (canApprove(user)) {
      listPendingApproval().then((p) => setPendingCount(p.length)).catch(() => {});
    }
  }, [user]);

  if (!user) return null;

  const today = new Date().toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Hero / dashboard band */}
      <section
        className="anim-fade-in relative overflow-hidden rounded-3xl px-6 py-6 sm:px-8 sm:py-7"
        style={{
          background:
            'radial-gradient(700px 300px at 92% -30%, rgba(6,182,212,0.28), transparent 60%), linear-gradient(135deg, #20244a 0%, #16182d 60%)',
        }}
      >
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-accent-400">
              לוח בקרה
            </div>
            <h1 className="mt-1 font-display text-[28px] font-extrabold text-white sm:text-[32px]">
              שלום, {user.full_name}
            </h1>
            <p className="mt-1 text-sm text-ink-200">{today}</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
            {canApprove(user) && (
              <Kpi label="ממתינים לאישור" value={pendingCount} icon="clock" />
            )}
            <Kpi label="הבד״חים שלי" value={summary?.total ?? 0} icon="clipboard-check" />
            <Kpi label="מאושרים" value={summary?.approved ?? 0} icon="shield-check" />
            <Kpi label="טיוטות פתוחות" value={drafts.length} icon="pen" />
          </div>
        </div>
      </section>

      {/* Resume draft */}
      {drafts.length > 0 && (
        <div className="card anim-slide-up flex flex-wrap items-center justify-between gap-3 border-r-4 border-r-pending-500 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pending-50 text-pending-600">
              <Icon name="pen" size={22} />
            </span>
            <div>
              <div className="font-bold text-ink-900">יש לך בד״ח שלא הושלם</div>
              <div className="text-sm text-slate-500">
                {drafts[0].name} · {formatDate(drafts[0].date)}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={() => navigate(`/form/${drafts[0].id}`)}>
              המשך בד״ח
            </button>
            {drafts.length > 1 && (
              <Link to="/my" className="btn-ghost btn-sm">
                עוד {drafts.length - 1} טיוטות
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div>
        <div className="eyebrow mb-3">פעולות</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canPerform(user) && (
            <ActionCard
              to="/new"
              title="בד״ח חדש"
              desc="התחל בדיקה חדשה מתוך בד״ח מפורסם"
              icon="plus"
              tone="brand"
            />
          )}
          <ActionCard
            to="/my"
            title="הבד״חים שלי"
            desc="טיוטות, ממתינים לאישור ומאושרים — הכול במקום אחד"
            icon="clipboard-check"
            tone="neutral"
          />
          {canApprove(user) && (
            <ActionCard
              to="/pending"
              title="ממתינים לאישור"
              desc="בד״חים שהושלמו וממתינים לחתימת מאשר"
              icon="clock"
              tone="pending"
              count={pendingCount}
            />
          )}
          <ActionCard
            to="/history"
            title="היסטוריית בד״חים"
            desc="חיפוש, צפייה והפקת PDF, Excel והדפסה"
            icon="history"
            tone="accent"
          />
          {isAdmin(user) && (
            <>
              <ActionCard
                to="/admin/templates"
                title="ניהול בד״חים"
                desc="יצירה, עריכה ופרסום בד״חים למשתמשים"
                icon="layers"
                tone="brand"
              />
              <ActionCard
                to="/admin/users"
                title="ניהול משתמשים"
                desc="משתמשים, הרשאות ואיפוס סיסמאות"
                icon="users"
                tone="neutral"
              />
              <ActionCard
                to="/admin"
                title="לוח ניהול"
                desc="דשבורד, הגדרות, גיבוי ו-Audit Log"
                icon="settings"
                tone="neutral"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
