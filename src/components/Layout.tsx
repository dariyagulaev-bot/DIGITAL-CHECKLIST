import { type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/services/rbac';
import { roleLabel } from '@/exports/labels';
import iconUrl from '@/assets/icon.svg';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-full flex flex-col">
      <header className="no-print sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <img src={iconUrl} alt="" className="h-9 w-9" />
            <span className="text-lg font-bold text-slate-800">מערכת בד״ח דיגיטלית</span>
          </Link>
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-sm font-semibold text-slate-700">שלום, {user.full_name}</span>
                <span className="text-xs text-slate-400">
                  {user.roles.map(roleLabel).join(' · ')}
                </span>
              </div>
              {isAdmin(user) && (
                <Link to="/admin" className="btn-outline !py-2 !px-3 text-sm">
                  ניהול
                </Link>
              )}
              <button className="btn-ghost !py-2 !px-3 text-sm" onClick={handleLogout}>
                יציאה
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
