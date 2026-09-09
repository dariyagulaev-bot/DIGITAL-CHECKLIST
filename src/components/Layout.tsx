import { type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/services/rbac';
import { roleLabel } from '@/exports/labels';
import { Icon } from './Icon';

/** Branded app mark — a gradient tile with the inspection glyph. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-2xl text-white shadow-soft"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(150deg, #574fe8 0%, #4338ca 55%, #06b6d4 160%)',
      }}
    >
      <Icon name="clipboard-check" size={size * 0.56} />
    </span>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <BrandMark size={40} />
            <div className="leading-tight">
              <div className="font-display text-[17px] font-extrabold text-ink-900">
                מערכת בד״ח דיגיטלית
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Digital Inspections
              </div>
            </div>
          </Link>

          {user && (
            <div className="flex items-center gap-2.5">
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-sm font-bold text-ink-800">{user.full_name}</div>
                <div className="flex justify-end gap-1">
                  {user.roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500"
                    >
                      {roleLabel(r)}
                    </span>
                  ))}
                </div>
              </div>
              {isAdmin(user) && (
                <Link to="/admin" className="btn-outline btn-sm gap-1.5" title="ניהול">
                  <Icon name="settings" size={17} />
                  <span className="hidden md:inline">ניהול</span>
                </Link>
              )}
              <button
                className="btn-ghost btn-sm gap-1.5"
                onClick={handleLogout}
                title="יציאה"
              >
                <Icon name="logout" size={17} />
                <span className="hidden md:inline">יציאה</span>
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="font-display text-[26px] font-extrabold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
