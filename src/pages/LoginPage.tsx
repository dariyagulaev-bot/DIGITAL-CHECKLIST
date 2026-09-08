import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { listActiveUsers } from '@/services/auth';
import type { User } from '@/types';
import iconUrl from '@/assets/icon.svg';

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
    <div className="min-h-full flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={iconUrl} alt="" className="h-16 w-16" />
          <h1 className="text-2xl font-bold text-slate-800">מערכת בד״ח דיגיטלית</h1>
          <p className="text-slate-500">התחברות למערכת</p>
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

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
          <div className="font-semibold text-slate-600">משתמשי דמו (יש לשנות סיסמאות):</div>
          <div className="mt-1 space-y-0.5">
            <div>מנהל: admin / admin123</div>
            <div>מבצע: performer / 1234</div>
            <div>מאשר: approver / 1234</div>
          </div>
        </div>
      </div>
    </div>
  );
}
