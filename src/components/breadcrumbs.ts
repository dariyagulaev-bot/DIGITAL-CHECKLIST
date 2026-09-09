export interface Crumb {
  label: string;
  to?: string;
}

/**
 * Static breadcrumb trail for a path (root → … → current). The last item is the
 * current screen (no link). Mirrors the app's information hierarchy, e.g.
 * ראשי ← ניהול ← ניהול בד״חים ← עריכת בד״ח.
 */
export function buildCrumbs(pathname: string): Crumb[] {
  const root: Crumb = { label: 'ראשי', to: '/' };
  const admin: Crumb = { label: 'ניהול', to: '/admin' };
  const templates: Crumb = { label: 'ניהול בד״חים', to: '/admin/templates' };

  if (pathname === '/') return [{ label: 'ראשי' }];
  if (pathname === '/new') return [root, { label: 'בד״ח חדש' }];
  if (pathname.startsWith('/form/')) return [root, { label: 'ביצוע בד״ח' }];
  if (pathname === '/my') return [root, { label: 'הבד״חים שלי' }];
  if (pathname === '/pending') return [root, { label: 'ממתינים לאישור' }];
  if (pathname === '/history') return [root, { label: 'היסטוריית בד״חים' }];
  if (pathname.startsWith('/view/')) return [root, { label: 'צפייה בבד״ח' }];
  if (pathname === '/admin') return [root, { label: 'ניהול' }];
  if (pathname === '/admin/users') return [root, admin, { label: 'משתמשים' }];
  if (pathname === '/admin/templates') return [root, admin, { label: 'ניהול בד״חים' }];
  if (pathname.startsWith('/admin/templates/'))
    return [root, admin, templates, { label: 'עריכת בד״ח' }];
  if (pathname === '/admin/audit') return [root, admin, { label: 'יומן ביקורת' }];
  if (pathname === '/admin/settings') return [root, admin, { label: 'הגדרות' }];
  if (pathname === '/admin/backup') return [root, admin, { label: 'גיבוי ושחזור' }];
  return [root];
}
