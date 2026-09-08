import { useEffect, useState } from 'react';
import { getSetting, setSetting, SettingKeys } from '@/services/settings';
import { hashPassword } from '@/services/auth';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/ui';

export default function SettingsPage() {
  const { notify } = useToast();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'personal_accounts' | 'shared_password'>('personal_accounts');
  const [sharedPw, setSharedPw] = useState('');
  const [orgName, setOrgName] = useState('');
  const [autoLogout, setAutoLogout] = useState('10');

  useEffect(() => {
    (async () => {
      const m = await getSetting(SettingKeys.APPROVAL_MODE);
      setMode(m === 'shared_password' ? 'shared_password' : 'personal_accounts');
      setOrgName((await getSetting(SettingKeys.ORG_NAME)) ?? '');
      setAutoLogout((await getSetting(SettingKeys.ADMIN_AUTOLOGOUT_MIN)) ?? '10');
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    await setSetting(SettingKeys.APPROVAL_MODE, mode);
    await setSetting(SettingKeys.ORG_NAME, orgName.trim());
    await setSetting(SettingKeys.ADMIN_AUTOLOGOUT_MIN, String(parseInt(autoLogout, 10) || 10));
    if (mode === 'shared_password' && sharedPw) {
      await setSetting(SettingKeys.APPROVER_SHARED_HASH, await hashPassword(sharedPw));
    }
    setSharedPw('');
    notify('ההגדרות נשמרו', 'ok');
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <section className="card p-5">
        <h2 className="mb-1 text-lg font-bold text-slate-700">הרשאות ואישור</h2>
        <p className="mb-4 text-sm text-slate-500">
          קביעת אופן אימות המאשר. מומלץ להשתמש בחשבונות אישיים כדי שהמערכת תדע בדיוק מי אישר.
        </p>
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input
              type="radio"
              className="mt-1 h-5 w-5"
              checked={mode === 'personal_accounts'}
              onChange={() => setMode('personal_accounts')}
            />
            <div>
              <div className="font-semibold text-slate-800">חשבונות מאשרים אישיים (מומלץ)</div>
              <div className="text-sm text-slate-500">
                כל מאשר מתחבר עם שם משתמש וסיסמה אישיים. מונע אישור עצמי לפי מזהה משתמש.
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input
              type="radio"
              className="mt-1 h-5 w-5"
              checked={mode === 'shared_password'}
              onChange={() => setMode('shared_password')}
            />
            <div className="flex-1">
              <div className="font-semibold text-slate-800">סיסמת מאשר משותפת</div>
              <div className="text-sm text-slate-500">
                סיסמה אחת לאישור (בנוסף לחשבון המאשר). ניתן לעבור בהמשך לחשבונות אישיים.
              </div>
              {mode === 'shared_password' && (
                <input
                  type="password"
                  className="input mt-2"
                  placeholder="הגדר/עדכן סיסמת מאשר משותפת"
                  value={sharedPw}
                  onChange={(e) => setSharedPw(e.target.value)}
                />
              )}
            </div>
          </label>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-slate-700">כללי</h2>
        <div className="space-y-4">
          <div>
            <label className="label">שם ארגון / מערכת</label>
            <input className="input" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          </div>
          <div>
            <label className="label">ניתוק מנהל אוטומטי לאחר (דקות)</label>
            <input
              type="number"
              min={1}
              className="input max-w-[140px]"
              value={autoLogout}
              onChange={(e) => setAutoLogout(e.target.value)}
            />
          </div>
        </div>
      </section>

      <button className="btn-primary btn-lg" onClick={save}>
        שמור הגדרות
      </button>
    </div>
  );
}
