import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { downloadJson, readJsonFile, timestampedName } from '@/services/backup';
import {
  getRole, setRole, getThisDevice, listDevices, registerDevice, authorizeDevice, setDeviceStatus, renameDevice,
  buildOutgoingPackage, applyIncomingPackage, markSent, listSyncLog, getLastCentralSyncAt,
  type SyncPackage,
} from '@/services/sync';
import type { Device, SyncLogEntry, VeroRole } from '@/types';

/** "מכשירים וסנכרון" — device registry + two-way package sync (central + tablet). */
export default function DevicesPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [role, setRoleState] = useState<VeroRole>('tablet');
  const [self, setSelf] = useState<Device | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [log, setLog] = useState<SyncLogEntry[]>([]);
  const [lastCentral, setLastCentral] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setRoleState(await getRole());
    setSelf(await getThisDevice());
    setDevices(await listDevices());
    setLog(await listSyncLog(50));
    setLastCentral(await getLastCentralSyncAt());
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const switchRole = async (r: VeroRole) => {
    if (r === role) return;
    if (!confirm(r === 'central'
      ? 'להפוך מכשיר זה לתחנה המרכזית (VERO Central)? התחנה המרכזית מקבלת בד״חים מכל הטאבלטים ומנהלת הגדרות ארגוניות.'
      : 'להחזיר מכשיר זה לתפקיד טאבלט (עמדת ביצוע)?')) return;
    await setRole(r);
    await refresh();
    notify(r === 'central' ? 'המכשיר הוגדר כתחנה מרכזית' : 'המכשיר הוגדר כטאבלט', 'ok');
  };

  // Export a sync package (direction decided by role).
  const exportPackage = async (targetDeviceId?: string) => {
    try {
      const pkg = await buildOutgoingPackage(targetDeviceId ? { targetDeviceId } : undefined);
      const forms = pkg.forms?.length ?? 0;
      const tpls = pkg.templates?.length ?? 0;
      downloadJson(pkg, timestampedName(role === 'central' ? 'vero_sync_to_device' : 'vero_sync_to_central'));
      await markSent({ targetDeviceId, at: pkg.created_at });
      if (role === 'central' && targetDeviceId) {
        const d = devices.find((x) => x.id === targetDeviceId);
        if (d) await renameDevice(d.id, d.friendly_name); // touch no-op to keep pattern; stats updated on real transport
      }
      notify(role === 'central' ? `נוצרה חבילת עדכונים (${tpls} תבניות)` : `נוצרה חבילת סנכרון (${forms} בד״חים)`, 'ok');
      await refresh();
    } catch (e) {
      notify('יצירת החבילה נכשלה: ' + (e as Error).message, 'error');
    }
  };

  const importPackage = async (file: File) => {
    try {
      const pkg = await readJsonFile<SyncPackage>(file);
      // On the central station, auto-register an unknown sender as pending.
      if (pkg.kind === 'device-to-central' && pkg.device) {
        const existing = devices.find((d) => d.id === pkg.from_device);
        if (!existing) { await registerDevice({ id: pkg.from_device, code: pkg.device.code, friendly_name: pkg.device.friendly_name }); await refresh(); }
      }
      const summary = await applyIncomingPackage(pkg, user ? { id: user.id, full_name: user.full_name } : undefined);
      notify(summary.message, 'ok');
      await refresh();
    } catch (e) {
      notify('הסנכרון לא הושלם: ' + (e as Error).message, 'error');
    }
  };

  const doAuthorize = async (d: Device) => { await authorizeDevice(d.id, user ? { id: user.id, full_name: user.full_name } : undefined); await refresh(); notify(`${d.code} אושר (טווח מספור ${d.ordinal || '—'})`, 'ok'); };
  const doToggle = async (d: Device) => { const s = d.status === 'disabled' ? 'authorized' : 'disabled'; await setDeviceStatus(d.id, s, user ? { id: user.id, full_name: user.full_name } : undefined); await refresh(); };
  const doRename = async (d: Device) => { const name = prompt('שם ידידותי למכשיר:', d.friendly_name); if (name == null) return; await renameDevice(d.id, name.trim() || d.friendly_name); await refresh(); };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Role */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-bold text-ink-900">תפקיד מכשיר זה</div>
            <div className="mt-0.5 text-[13px] text-ink-500">
              {role === 'central' ? 'תחנה מרכזית (VERO Central) — מקבלת בד״חים ומנהלת הגדרות' : 'טאבלט — עמדת ביצוע עצמאית'}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button className={`btn-sm ${role === 'tablet' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => switchRole('tablet')}>טאבלט</button>
            <button className={`btn-sm ${role === 'central' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => switchRole('central')}>תחנה מרכזית</button>
          </div>
        </div>
        {self && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[12.5px] text-ink-600">
            <span>מזהה מכשיר: <b className="text-ink-800">{self.code}</b></span>
            <span>שם: <b className="text-ink-800">{self.friendly_name}</b></span>
            <span>מצב: <b className="text-ink-800">{statusLabel(self.status)}</b></span>
            {self.ordinal > 0 && <span>טווח מספור: <b className="text-ink-800 nums">#{self.ordinal}</b></span>}
            {role === 'tablet' && <span>אומת מול המרכז: <b className="text-ink-800">{lastCentral ? fmt(lastCentral) : 'טרם סונכרן'}</b></span>}
          </div>
        )}
      </section>

      {/* Sync actions */}
      <section className="card p-4">
        <div className="mb-1 text-[15px] font-bold text-ink-900">סנכרון</div>
        <p className="mb-3 text-[13px] text-ink-500">
          {role === 'central'
            ? 'קלוט חבילות בד״חים מטאבלטים, ושלח להם עדכוני הגדרות. הסנכרון בטוח לייבוא חוזר ולהמשך לאחר ניתוק.'
            : 'צור חבילת סנכרון להעברה לתחנה המרכזית (USB מאושר), וקלוט ממנה עדכוני הגדרות. הפעולה אינה דורשת אינטרנט.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {role === 'tablet' && (
            <button className="btn-primary gap-1.5" onClick={() => exportPackage()}>
              <Icon name="download" size={17} /> ייצוא חבילת סנכרון (למרכז)
            </button>
          )}
          <button className="btn-secondary gap-1.5" onClick={() => importRef.current?.click()}>
            <Icon name="refresh" size={17} /> {role === 'central' ? 'ייבוא חבילת סנכרון מטאבלט' : 'ייבוא עדכונים מהמרכז'}
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importPackage(f); e.currentTarget.value = ''; }} />
        </div>
      </section>

      {/* Central: device registry */}
      {role === 'central' && (
        <section className="card p-4">
          <div className="mb-2 text-[15px] font-bold text-ink-900">מכשירים רשומים</div>
          {devices.filter((d) => !d.is_self).length === 0 ? (
            <p className="text-[13px] text-ink-400">עדיין אין מכשירים רשומים. קליטת חבילת סנכרון מטאבלט תרשום אותו אוטומטית (ממתין לאישור).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-right text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-ink-500">
                    <th className="p-2 font-semibold">מכשיר</th>
                    <th className="p-2 font-semibold">סנכרון אחרון</th>
                    <th className="p-2 font-semibold">בד״חים</th>
                    <th className="p-2 font-semibold">מצב</th>
                    <th className="p-2 font-semibold">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.filter((d) => !d.is_self).map((d) => (
                    <tr key={d.id} className="border-b border-slate-100">
                      <td className="p-2"><div className="font-bold text-ink-800">{d.code}</div><div className="text-[12px] text-ink-500">{d.friendly_name}</div></td>
                      <td className="p-2 text-ink-600">{d.last_sync_at ? fmt(d.last_sync_at) : 'טרם סונכרן'}</td>
                      <td className="p-2 nums text-ink-600">{d.received_forms ?? 0}</td>
                      <td className="p-2"><StatusBadge status={d.status} /></td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {d.status !== 'authorized' && <button className="btn-ghost btn-sm text-ok-700" onClick={() => doAuthorize(d)}>אשר</button>}
                          {d.status === 'authorized' && <button className="btn-ghost btn-sm" onClick={() => exportPackage(d.id)}>שלח עדכונים</button>}
                          <button className="btn-ghost btn-sm" onClick={() => doRename(d)}>שם</button>
                          <button className="btn-ghost btn-sm text-fault-600" onClick={() => doToggle(d)}>{d.status === 'disabled' ? 'הפעל' : 'השבת'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Sync history */}
      <section className="card p-4">
        <div className="mb-2 text-[15px] font-bold text-ink-900">היסטוריית סנכרונים</div>
        {log.length === 0 ? (
          <p className="text-[13px] text-ink-400">עדיין לא בוצעו סנכרונים.</p>
        ) : (
          <div className="space-y-1.5">
            {log.map((e) => (
              <div key={e.id} className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md border px-3 py-1.5 text-[12.5px] ${e.ok ? 'border-slate-200 bg-white' : 'border-fault-200 bg-fault-50'}`}>
                <Icon name={e.direction === 'in' ? 'download' : 'refresh'} size={14} className={e.ok ? 'text-ink-400' : 'text-fault-500'} />
                <span className="text-ink-500">{fmt(e.at)}</span>
                <span className="font-semibold text-ink-700">{e.direction === 'in' ? 'נקלט' : 'נשלח'}</span>
                {e.peer_code && <span className="text-ink-500">{e.peer_code}</span>}
                <span className="text-ink-700">{e.message}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-[12px] text-ink-400">
        הערה: שלב זה מסנכרן באמצעות חבילה (USB מאושר). חיבור LAN אוטומטי, אימות הדדי והצפנה — מתוכננים כשלב הבא ודורשים אישור גורמי המחשוב ואבטחת המידע.
      </p>
    </div>
  );
}

function statusLabel(s: Device['status']): string {
  return s === 'authorized' ? 'מאושר' : s === 'pending' ? 'ממתין לאישור' : 'מושבת';
}
function StatusBadge({ status }: { status: Device['status'] }) {
  const map = { authorized: 'border-ok-200 bg-ok-50 text-ok-700', pending: 'border-pending-200 bg-pending-50 text-pending-700', disabled: 'border-slate-200 bg-slate-50 text-ink-500' } as const;
  return <span className={`rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${map[status]}`}>{statusLabel(status)}</span>;
}
function fmt(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
