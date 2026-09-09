import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { listActiveUsers } from '@/services/auth';
import type { User } from '@/types';
import { VeroLogo } from '@/components/VeroLogo';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listActiveUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(username, password);
      if (!u) {
        setError('שם משתמש או סיסמה שגויים, או שהמשתמש אינו פעיל.');
        return;
      }
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-[#eef1f6] p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <VeroLogo variant="full" tone="light" />
        </div>
        <div className="card p-8 shadow-soft">
          <div className="mb-5 text-center">
            <h1 className="text-[18px] font-bold text-ink-900">התחברות למערכת</h1>
            <p className="mt-0.5 text-[13px] text-ink-500">הזן שם משתמש וסיסמה</p>
          </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">בחירת משתמש</label>
            <select
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            >
              <option value="">— בחר משתמש או הקלד למטה —</option>
              {users.map((u) => (
                <option key={u.id} value={u.username}>
                  {u.full_name} ({u.username})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">שם משתמש</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="שם משתמש"
            />
          </div>
          <div>
            <label className="label">סיסמה</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="סיסמה"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-fault-50 px-4 py-3 text-sm font-medium text-fault-700">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary btn-lg w-full" disabled={busy}>
            {busy ? 'מתחבר…' : 'כניסה'}
          </button>
        </form>

          <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3.5 text-xs text-ink-500">
            <div className="font-semibold text-ink-600">משתמשי דמו (יש לשנות סיסמאות):</div>
            <div className="mt-1 space-y-0.5">
              <div>מנהל: admin / admin123</div>
              <div>מבצע: performer / 1234</div>
              <div>מאשר: approver / 1234</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
