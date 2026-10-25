import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/services/rbac';
import { downloadJson, readJsonFile, timestampedName } from '@/services/backup';
import {
  getRole, getThisDevice, getLastCentralSyncAt, buildOutgoingPackage, applyIncomingPackage, markSent,
  type SyncPackage,
} from '@/services/sync';
import type { VeroRole } from '@/types';

type Phase = 'idle' | 'working' | 'ok' | 'error';

/**
 * Compact sync status chip for the tablet home screen. Phase 1 syncs by package
 * (USB/file): "סנכרן עכשיו" exports a package to hand to the central station,
 * and updates can be imported back. The live auto-connect states belong to the
 * LAN transport (Phase 2).
 */
export function SyncIndicator() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [role, setRole] = useState<VeroRole>('tablet');
  const [last, setLast] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setRole(await getRole());
    setLast(await getLastCentralSyncAt());
    setAuthorized((await getThisDevice()).status === 'authorized');
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  if (role === 'central') return null; // central shows its own device screen

  const syncNow = async () => {
    setPhase('working'); setMsg('מסנכרן נתונים…');
    try {
      const pkg = await buildOutgoingPackage();
      downloadJson(pkg, timestampedName('vero_sync_to_central'));
      await markSent({ at: pkg.created_at });
      setPhase('ok'); setMsg(`הסנכרון הושלם בהצלחה · ${pkg.forms?.length ?? 0} בד״חים מוכנים להעברה`);
      notify('חבילת הסנכרון נוצרה והנתונים נשמרו בטאבלט', 'ok');
      await refresh();
    } catch (e) {
      setPhase('error'); setMsg('הסנכרון לא הושלם. הנתונים נשמרו בטאבלט ויועברו בניסיון הבא.');
      notify((e as Error).message, 'error');
    }
  };

  const importUpdates = async (file: File) => {
    setPhase('working'); setMsg('מסנכרן נתונים…');
    try {
      const pkg = await readJsonFile<SyncPackage>(file);
      const summary = await applyIncomingPackage(pkg, user ? { id: user.id, full_name: user.full_name } : undefined);
      setPhase('ok'); setMsg('הסנכרון הושלם בהצלחה · ' + summary.message);
      notify(summary.message, 'ok');
      await refresh();
    } catch (e) {
      setPhase('error'); setMsg('הסנכרון לא הושלם. ' + (e as Error).message);
      notify((e as Error).message, 'error');
    }
  };

  const tone =
    phase === 'ok' ? 'border-ok-200 bg-ok-50 text-ok-700'
      : phase === 'error' ? 'border-fault-200 bg-fault-50 text-fault-700'
        : phase === 'working' ? 'border-brand-200 bg-brand-50 text-brand-700'
          : authorized ? 'border-slate-200 bg-white text-ink-600' : 'border-pending-200 bg-pending-50 text-pending-700';

  const statusText =
    phase !== 'idle' ? msg
      : !authorized ? 'לא מחובר לתחנה המרכזית — המכשיר ממתין לאישור'
        : last ? `סונכרן לאחרונה: ${fmt(last)}` : 'טרם סונכרן עם התחנה המרכזית';

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-[13px] ${tone}`}>
      <span className="flex items-center gap-1.5 font-medium">
        <Icon name={phase === 'working' ? 'refresh' : phase === 'ok' ? 'check' : phase === 'error' ? 'alert' : 'database'} size={15} className={phase === 'working' ? 'animate-spin' : ''} />
        {statusText}
      </span>
      <div className="ms-auto flex items-center gap-1.5">
        <button type="button" className="btn-secondary btn-sm gap-1.5" onClick={syncNow} disabled={phase === 'working'}>
          <Icon name="refresh" size={14} /> סנכרן עכשיו
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => importRef.current?.click()} disabled={phase === 'working'}>ייבוא עדכונים</button>
        {user && isAdmin(user) && <Link to="/admin/devices" className="btn-ghost btn-sm">ניהול</Link>}
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importUpdates(f); e.currentTarget.value = ''; }} />
      </div>
    </div>
  );
}

function fmt(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
