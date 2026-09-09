import { type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useNavGuard } from '@/context/NavGuardContext';
import { roleLabel } from '@/exports/labels';
import { Icon } from './Icon';
import { VeroLogo } from './VeroLogo';
import { buildCrumbs } from './breadcrumbs';

/** Official emblem — a crisp white tile with the inspection glyph in navy. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded bg-white text-navy-800"
      style={{ width: size, height: size }}
    >
      <Icon name="clipboard-check" size={size * 0.62} />
    </span>
  );
}

/** Back control — steps back one screen (never logs out), via the nav guard. */
export function BackButton({ className = '' }: { className?: string }) {
  const { attemptBack } = useNavGuard();
  return (
    <button
      type="button"
      onClick={attemptBack}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[13.5px] font-semibold text-ink-600 transition-colors hover:bg-slate-100 hover:text-ink-800 ${className}`}
    >
      <Icon name="back" size={17} />
      חזרה
    </button>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const crumbs = buildCrumbs(pathname);
  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-[13px]">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {c.to && !last ? (
              <Link to={c.to} className="font-medium text-ink-500 hover:text-brand-600">
                {c.label}
              </Link>
            ) : (
              <span className={last ? 'font-bold text-ink-800' : 'text-ink-500'}>{c.label}</span>
            )}
            {!last && <Icon name="chevron-start" size={13} className="text-ink-300" />}
          </span>
        );
      })}
    </nav>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* Official navy header */}
      <header className="no-print sticky top-0 z-30 bg-navy-900 text-white shadow-header">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center" aria-label="VERO — דף הבית">
            <VeroLogo variant="compact" tone="dark" />
          </Link>

          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden text-left leading-tight sm:block">
                <div className="text-[13.5px] font-semibold text-white">{user.full_name}</div>
                <div className="text-[11px] text-navy-200">
                  {user.roles.map(roleLabel).join(' · ')}
                </div>
              </div>
              <span className="hidden h-6 w-px bg-white/15 sm:block" />
              <button
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13.5px] font-semibold text-navy-100 transition-colors hover:bg-white/10 hover:text-white"
                onClick={handleLogout}
              >
                <Icon name="logout" size={17} />
                יציאה
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Sub-bar: back + breadcrumbs (internal screens only) */}
      {!isHome && (
        <div className="no-print border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-11 max-w-6xl items-center gap-3 px-4">
            <BackButton />
            <span className="h-4 w-px bg-slate-200" />
            <Breadcrumbs pathname={location.pathname} />
          </div>
        </div>
      )}

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
    <div className="no-print mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-extrabold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[14px] text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
