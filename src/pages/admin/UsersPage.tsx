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
import { listSystems } from '@/services/systems';
import { listRanks } from '@/services/ranks';
import { listCertifications, setCertification } from '@/services/certifications';
import { certifierScope, setCertifierAuthorizations } from '@/services/certifiers';
import { identityTypeLabel, validateIdentity } from '@/services/identity';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Modal, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { roleLabel } from '@/exports/labels';
import { RoleName, type IdentityType, type Rank, type System, type UserWithRoles } from '@/types';

const ALL_ROLES = [RoleName.PERFORMER, RoleName.APPROVER, RoleName.ADMIN, RoleName.CERTIFIER];

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
        <button className="btn-primary btn-sm gap-1.5" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> משתמש חדש
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
  // Protected identity (admin-only). Never used as username/login/display.
  const [idType, setIdType] = useState<IdentityType>(user?.id_type ?? 'personal');
  const [idNumber, setIdNumber] = useState(user?.id_number ?? '');
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
    // Identity is OPTIONAL, but if a number was entered it must be valid for its type.
    const idTrim = idNumber.trim();
    if (idTrim) {
      const idErr = validateIdentity(idType, idTrim);
      if (idErr) {
        notify(idErr, 'error');
        return;
      }
    }
    setBusy(true);
    try {
      if (user) {
        await updateUserProfile(user.id, {
          full_name: fullName,
          username,
          id_type: idType,
          id_number: idTrim,
        });
        await setUserRoles(user.id, roles);
        if (password) await resetPassword(user.id, password);
      } else {
        await createUser({
          username,
          full_name: fullName,
          password,
          roles,
          id_type: idType,
          id_number: idTrim || undefined,
        });
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

        {admin && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Icon name="shield-check" size={16} />
              זיהוי מוגן (מסמך הסמכה בלבד)
            </div>
            <p className="mb-2 text-xs text-slate-500">
              משמש אך ורק למנגנון ההסמכה והנפקת תעודות. אינו שם משתמש/סיסמה/כניסה,
              ואינו מוצג במסכים, בבד״חים, בחתימות, בייצוא או בחיפוש הרגילים.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                className="input sm:w-44"
                value={idType}
                onChange={(e) => setIdType(e.target.value as IdentityType)}
              >
                <option value="personal">{identityTypeLabel('personal')}</option>
                <option value="national">{identityTypeLabel('national')}</option>
              </select>
              <input
                className="input flex-1"
                inputMode="numeric"
                placeholder={idType === 'national' ? '9 ספרות' : '3–10 ספרות'}
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
        )}

        {user && admin && (
          <UserCertifications
            userId={user.id}
            actor={{ id: admin.id, full_name: admin.full_name }}
          />
        )}

        {user && admin && roles.includes(RoleName.CERTIFIER) && (
          <CertifierAuthorizations
            userId={user.id}
            actor={{ id: admin.id, full_name: admin.full_name }}
          />
        )}

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

/**
 * Per-system certification editor (הסמכות / שיוך למערכות ודרגים). For each
 * system the admin picks ONE "דרג הסמכה מרבי" — the highest rank the user may
 * inspect in that system. Because ranks are hierarchical, that single choice
 * covers every rank below it, so an illegal combination (e.g. ד׳ without ב׳)
 * cannot be expressed. "ללא הסמכה" removes the certification for the system.
 * Each change is persisted immediately and audited (user + date + exact time).
 */
function UserCertifications({
  userId,
  actor,
}: {
  userId: string;
  actor: { id: string; full_name: string };
}) {
  const { notify } = useToast();
  const [systems, setSystems] = useState<System[] | null>(null);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [maxBySystem, setMaxBySystem] = useState<Map<string, string>>(new Map());
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    const [sys, rnk, certs] = await Promise.all([
      listSystems(false),
      listRanks(false),
      listCertifications(userId),
    ]);
    setSystems(sys);
    setRanks([...rnk].sort((a, b) => a.sort_order - b.sort_order));
    setMaxBySystem(new Map(certs.map((c) => [c.system_id, c.max_rank_id])));
  };

  useEffect(() => {
    load().catch(() => setSystems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const change = async (systemId: string, maxRankId: string | null) => {
    setSavingId(systemId);
    try {
      await setCertification(userId, systemId, maxRankId, actor);
      setMaxBySystem((prev) => {
        const next = new Map(prev);
        if (maxRankId) next.set(systemId, maxRankId);
        else next.delete(systemId);
        return next;
      });
      notify('ההסמכה נשמרה', 'ok');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <Icon name="shield-check" size={16} />
        הסמכות — שיוך למערכות ודרגים
      </div>
      {systems === null ? (
        <Spinner />
      ) : systems.length === 0 ? (
        <p className="text-sm text-slate-500">לא הוגדרו מערכות במערכת.</p>
      ) : ranks.length === 0 ? (
        <p className="text-sm text-slate-500">לא הוגדרו דרגים במערכת.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            לכל מערכת נבחר דרג הסמכה מרבי. דרג גבוה כולל אוטומטית את כל הדרגים שתחתיו.
          </p>
          {systems.map((s) => {
            const current = maxBySystem.get(s.id) ?? '';
            return (
              <div key={s.id} className="flex items-center gap-3">
                <span className="min-w-[8rem] flex-1 text-sm text-slate-700">{s.name}</span>
                <select
                  className="input w-48"
                  value={current}
                  disabled={savingId === s.id}
                  onChange={(e) => change(s.id, e.target.value || null)}
                >
                  <option value="">ללא הסמכה</option>
                  {ranks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * CERTIFIER (מסמיך) authorization matrix. The CERTIFIER role alone grants
 * nothing — the user may only certify in the exact (system, rank) pairs ticked
 * here. ADMIN/APPROVER are never implicitly certifiers. Each save replaces the
 * whole set and is audited (CERTIFIER_AUTH_CHANGE). Removing a tick never
 * affects certifications/certificates already issued — only future actions.
 */
function CertifierAuthorizations({
  userId,
  actor,
}: {
  userId: string;
  actor: { id: string; full_name: string };
}) {
  const { notify } = useToast();
  const [systems, setSystems] = useState<System[] | null>(null);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [scope, setScope] = useState<Map<string, Set<string>>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [sys, rnk, sc] = await Promise.all([
        listSystems(false),
        listRanks(false),
        certifierScope(userId),
      ]);
      setSystems(sys);
      setRanks([...rnk].sort((a, b) => a.sort_order - b.sort_order));
      setScope(sc);
    })().catch(() => setSystems([]));
  }, [userId]);

  const allows = (sysId: string, rankId: string) => !!scope.get(sysId)?.has(rankId);

  const toggle = async (sysId: string, rankId: string) => {
    // Build next scope, then persist the full pair list (replace-set).
    const next = new Map<string, Set<string>>();
    for (const [s, set] of scope) next.set(s, new Set(set));
    if (!next.has(sysId)) next.set(sysId, new Set());
    const set = next.get(sysId)!;
    if (set.has(rankId)) set.delete(rankId);
    else set.add(rankId);
    const pairs: Array<{ system_id: string; rank_id: string }> = [];
    for (const [s, rk] of next) for (const r of rk) pairs.push({ system_id: s, rank_id: r });
    setSaving(true);
    try {
      await setCertifierAuthorizations(userId, pairs, actor);
      setScope(next);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <Icon name="shield-check" size={16} />
        הרשאות הסמכה (מסמיך) — לפי מערכת ודרג
      </div>
      {systems === null ? (
        <Spinner />
      ) : systems.length === 0 || ranks.length === 0 ? (
        <p className="text-sm text-slate-500">יש להגדיר מערכות ודרגים תחילה.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            המשתמש יוכל להסמיך אך ורק בצירופי מערכת+דרג המסומנים. היות ומשתמש הוא בעל
            הרשאת מסמיך אינו מקנה הרשאה אוטומטית לכל המערכות/הדרגים.
          </p>
          <div className="overflow-x-auto">
            <table className="text-right text-sm">
              <thead>
                <tr className="text-slate-600">
                  <th className="p-2" />
                  {ranks.map((r) => (
                    <th key={r.id} className="p-2 font-medium">
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {systems.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="p-2 font-medium text-slate-700">{s.name}</td>
                    {ranks.map((r) => (
                      <td key={r.id} className="p-2 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand-600"
                          disabled={saving}
                          checked={allows(s.id, r.id)}
                          onChange={() => toggle(s.id, r.id)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
