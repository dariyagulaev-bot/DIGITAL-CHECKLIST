import { NavLink, Outlet } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    title: 'מבנה מערכות',
    items: [
      { to: '/admin/systems', label: 'סוגי מערכת', icon: 'database' },
      { to: '/admin/units', label: 'יחידות', icon: 'layers' },
      { to: '/admin/ranks', label: 'דרגי בדיקה', icon: 'shield-check' },
    ],
  },
  {
    title: 'בדיקות ובד״חים',
    items: [{ to: '/admin/templates', label: 'תבניות בד״ח', icon: 'file' }],
  },
  {
    title: 'משתמשים והרשאות',
    items: [{ to: '/admin/users', label: 'משתמשים', icon: 'users' }],
  },
  {
    title: 'סטטיסטיקות',
    items: [{ to: '/admin', label: 'לוח בקרה', icon: 'clipboard-check', end: true }],
  },
  {
    title: 'הגדרות',
    items: [
      { to: '/admin/settings', label: 'הגדרות מערכת', icon: 'settings' },
      { to: '/admin/backup', label: 'גיבוי ושחזור', icon: 'download' },
      { to: '/admin/audit', label: 'יומן ביקורת', icon: 'history' },
    ],
  },
];

export default function AdminLayout() {
  return (
    <div>
      <div className="mb-5">
        <div className="eyebrow mb-1">ADMIN</div>
        <h1 className="text-[22px] font-extrabold text-ink-900">מרכז ניהול VERO</h1>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        <nav className="lg:w-60 lg:shrink-0">
          <div className="card divide-y divide-slate-100 p-2">
            {groups.map((g) => (
              <div key={g.title} className="py-2 first:pt-0 last:pb-0">
                <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                  {g.title}
                </div>
                <div className="space-y-0.5">
                  {g.items.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      end={it.end}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] font-semibold transition-colors ${
                          isActive
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-ink-600 hover:bg-slate-50 hover:text-ink-900'
                        }`
                      }
                    >
                      <Icon name={it.icon} size={17} />
                      {it.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
