import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { listAlertsForUser, type CertDetail } from '@/services/certifications';
import { dots, remainingLabel, todayStr } from '@/services/dates';
import { Modal } from './ui';

/**
 * After login, if the signed-in user has any certification that needs renewal
 * or has expired, show ONE consolidated popup (never a stream of them). Closing
 * it only dismisses it for this session — it is NOT marked as handled and will
 * appear again on the next login until an admin enters a new renewal date. The
 * persistent home-screen chip (see HomePage) stays until then too.
 */
export function CertRenewalAlert() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<CertDetail[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) {
      setAlerts([]);
      return;
    }
    setDismissed(false);
    listAlertsForUser(user.id)
      .then(setAlerts)
      .catch(() => setAlerts([]));
  }, [user?.id]);

  if (!user || alerts.length === 0 || dismissed) return null;
  const anyExpired = alerts.some((a) => a.status === 'expired');

  return (
    <Modal open onClose={() => setDismissed(true)} title="יש לבצע רענון הסמכה" tone="lock" icon="alert" maxWidth="max-w-lg">
      <div className="space-y-4">
        <p className="text-[14px] text-ink-700">
          {anyExpired ? 'חלק מהסמכותיך פגו או מתקרבות לתאריך התפוגה.' : 'הסמכתך מתקרבת לתאריך התפוגה.'}
        </p>
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.cert.id}
              className={`rounded-xl border p-3 ${
                a.status === 'expired' ? 'border-fault-200 bg-fault-50/60' : 'border-pending-200 bg-pending-50/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[14px] font-bold text-ink-900">{a.system_name}</div>
                <span className={`badge ${a.status === 'expired' ? 'bg-fault-100 text-fault-700' : 'bg-pending-100 text-pending-700'}`}>
                  {a.status === 'expired' ? 'פג תוקף' : 'נדרש רענון'}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[13px] text-ink-700">
                <div>דרג הסמכה: <span className="font-semibold">{a.rank_name}</span></div>
                <div>בתוקף עד: <span className="font-semibold nums">{dots(a.expires_at)}</span></div>
                {a.status === 'needs_renewal' && a.expires_at && (
                  <div className="col-span-2">נותרו: <span className="font-semibold text-pending-700">{remainingLabel(todayStr(), a.expires_at)}</span></div>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[13px] font-semibold text-ink-700">יש לפנות למנהל המערכת לביצוע רענון ההסמכה.</p>
        <button className="btn-primary w-full" onClick={() => setDismissed(true)}>הבנתי</button>
      </div>
    </Modal>
  );
}
