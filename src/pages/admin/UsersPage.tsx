import { useEffect, useState } from 'react';
import {
  createUser,
  listUsersWithRoles,
  resetPassword,
  setUserActive,
  setUserRoles,
  updateUserProfile,
} from '@/services/auth';
import { logAudit } from '@/services/audit';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Modal, Spinner } from '@/components/ui';
import { roleLabel } from '@/exports/labels';
import { RoleName, type UserWithRoles } from '@/types';

const ALL_ROLES = [RoleName.PERFORMER, RoleName.APPROVER, RoleName.ADMIN];

export default function UsersPage() {
  const { user: admin } = useAuth();
  const { notify } = useToast();
  const [users, setUsers] = useState<UserWithRoles[] | null>(null);
  const [editing, setEditing] = useState<UserWithRoles | 'new' | null>(null);

  const load = () => listUsersWithRoles().then(setUsers).catch(() => setUsers([]));
  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (u: UserWithRoles) => {
    await setUserActive(u.id, !u.active);
    if (admin)
      await logAudit({
        user_id: admin.id,
        user_name: admin.full_name,
        action: u.active ? 'DEACTIVATE_USER' : 'ACTIVATE_USER',
        entity_type: 'user',
        entity_id: u.id,
      });
    notify('סטטוס המשתמש עודכן', 'ok');
    load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-700">ניהול משתמשים</h2>
        <button className="btn-primary" onClick={() => setEditing('new')}>
          ➕ משתמש חדש
        </button>
      </div>

      {users === null ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="p-3">שם מלא</th>
                <th className="p-3">שם משתמש</th>
                <th className="p-3">הרשאות</th>
                <th className="p-3">סטטוס</th>
                <th className="p-3">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="p-3 font-medium text-slate-800">{u.full_name}</td>
                  <td className="p-3">{u.username}</td>
                  <td className="p-3">{u.roles.map(roleLabel).join(', ') || '—'}</td>
                  <td className="p-3">
                    {u.active ? (
                      <span className="badge bg-ok-100 text-ok-700">פעיל</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">מושבת</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button className="link" onClick={() => setEditing(u)}>
                        ערוך
                      </button>
                      <span className="text-slate-300">|</span>
                      <button className="link" onClick={() => toggleActive(u)}>
                        {u.active ? 'השבת' : 'הפעל'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <UserEditor
          user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function UserEditor({
  user,
  onClose,
  onSaved,
}: {
  user: UserWithRoles | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user: admin } = useAuth();
  const { notify } = useToast();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<RoleName[]>(user?.roles ?? [RoleName.PERFORMER]);
  const [busy, setBusy] = useState(false);

  const toggleRole = (r: RoleName) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim()) {
      notify('יש למלא שם מלא ושם משתמש', 'error');
      return;
    }
    if (!user && password.length < 4) {
      notify('סיסמה של 4 תווים לפחות', 'error');
      return;
    }
    setBusy(true);
    try {
      if (user) {
        await updateUserProfile(user.id, { full_name: fullName, username });
        await setUserRoles(user.id, roles);
        if (password) await resetPassword(user.id, password);
      } else {
        await createUser({ username, full_name: fullName, password, roles });
      }
      if (admin)
        await logAudit({
          user_id: admin.id,
          user_name: admin.full_name,
          action: user ? 'UPDATE_USER' : 'CREATE_USER',
          entity_type: 'user',
          entity_id: user?.id ?? username,
        });
      notify('המשתמש נשמר', 'ok');
      onSaved();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={user ? 'עריכת משתמש' : 'משתמש חדש'}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">שם מלא</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label">שם משתמש</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="label">
            {user ? 'סיסמה חדשה (השאר ריק כדי לא לשנות)' : 'סיסמה'}
          </label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label">הרשאות</label>
          <div className="flex flex-wrap gap-2">
            {ALL_ROLES.map((r) => (
              <label
                key={r}
                className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium ${
                  roles.includes(r)
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-300 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={roles.includes(r)}
                  onChange={() => toggleRole(r)}
                />
                {roleLabel(r)}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1" disabled={busy}>
            שמור
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            ביטול
          </button>
        </div>
      </form>
    </Modal>
  );
}
