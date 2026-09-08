import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canApprove, canPerform, isAdmin } from '@/services/rbac';
import { listDrafts, listPendingApproval } from '@/services/forms';
import type { CompletedForm } from '@/types';
import { formatDate } from '@/exports/labels';

interface TileProps {
  to: string;
  title: string;
  desc: string;
  icon: string;
  accent: string;
  badge?: number;
}

function Tile({ to, title, desc, icon, accent, badge }: TileProps) {
  return (
    <Link
      to={to}
      className="card group relative flex items-start gap-4 p-6 transition-shadow hover:shadow-soft"
    >
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl ${accent}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-lg font-bold text-slate-800">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{desc}</div>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="absolute left-4 top-4 flex h-7 min-w-7 items-center justify-center rounded-full bg-pending-500 px-2 text-sm font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<CompletedForm[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    listDrafts(user.id).then(setDrafts).catch(() => {});
    if (canApprove(user)) {
      listPendingApproval().then((p) => setPendingCount(p.length)).catch(() => {});
    }
  }, [user]);

  if (!user) return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">שלום, {user.full_name} 👋</h1>
        <p className="mt-1 text-slate-500">מה תרצה לעשות היום?</p>
      </div>

      {drafts.length > 0 && (
        <div className="mb-6 card border-r-4 border-r-pending-500 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-800">נמצא בד״ח שלא הושלם</div>
              <div className="text-sm text-slate-500">
                {drafts[0].name} · {formatDate(drafts[0].date)} — האם להמשיך?
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => navigate(`/form/${drafts[0].id}`)}>
                המשך בד״ח
              </button>
              <Link to="/my" className="btn-ghost">
                כל הטיוטות ({drafts.length})
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {canPerform(user) && (
          <Tile
            to="/new"
            title="בד״ח חדש"
            desc="פתיחת בד״ח חדש מתוך תבנית פעילה"
            icon="➕"
            accent="bg-brand-100 text-brand-700"
          />
        )}
        <Tile
          to="/my"
          title="הבד״חים שלי"
          desc="הבד״חים שביצעת — טיוטות, ממתינים ומאושרים"
          icon="📋"
          accent="bg-slate-100 text-slate-700"
        />
        {canApprove(user) && (
          <Tile
            to="/pending"
            title="ממתינים לאישור"
            desc="בד״חים הממתינים לחתימת מאשר"
            icon="✅"
            accent="bg-pending-100 text-pending-700"
            badge={pendingCount}
          />
        )}
        <Tile
          to="/history"
          title="היסטוריית בד״חים"
          desc="חיפוש, צפייה, PDF, Excel והדפסה"
          icon="🗂️"
          accent="bg-ok-100 text-ok-700"
        />
        {isAdmin(user) && (
          <Tile
            to="/admin"
            title="לוח ניהול"
            desc="משתמשים, תבניות, הגדרות, גיבוי ו-Audit Log"
            icon="⚙️"
            accent="bg-brand-100 text-brand-700"
          />
        )}
      </div>
    </div>
  );
}
