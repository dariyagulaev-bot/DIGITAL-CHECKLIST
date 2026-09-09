import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/admin', label: 'לוח בקרה', end: true },
  { to: '/admin/systems', label: 'מערכות' },
  { to: '/admin/users', label: 'משתמשים' },
  { to: '/admin/templates', label: 'בד״חים' },
  { to: '/admin/audit', label: 'Audit Log' },
  { to: '/admin/settings', label: 'הגדרות' },
  { to: '/admin/backup', label: 'גיבוי ושחזור' },
];

export default function AdminLayout() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-slate-800">לוח ניהול</h1>
      <div className="no-print mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
