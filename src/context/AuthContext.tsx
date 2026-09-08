import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { login as loginService, withRoles, getUserById } from '@/services/auth';
import { getAdminAutoLogoutMinutes } from '@/services/settings';
import { isAdmin } from '@/services/rbac';
import type { UserWithRoles } from '@/types';

interface AuthState {
  user: UserWithRoles | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<UserWithRoles | null>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const SESSION_KEY = 'checklist_session_user_id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithRoles | null>(null);
  const [loading, setLoading] = useState(true);
  const logoutTimer = useRef<number | null>(null);

  // Restore an existing session (user id) on load.
  useEffect(() => {
    (async () => {
      try {
        const id = sessionStorage.getItem(SESSION_KEY);
        if (id) {
          const u = await getUserById(id);
          if (u && u.active) setUser(await withRoles(u));
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const u = await loginService(username, password);
    if (u) {
      setUser(u);
      try {
        sessionStorage.setItem(SESSION_KEY, u.id);
      } catch {
        /* ignore */
      }
    }
    return u;
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    const u = await getUserById(user.id);
    if (u) setUser(await withRoles(u));
  }, [user]);

  // Auto-logout for admin sessions after inactivity (security requirement).
  useEffect(() => {
    if (!user || !isAdmin(user)) return;
    let minutes = 10;
    let cancelled = false;

    const arm = async () => {
      minutes = await getAdminAutoLogoutMinutes();
      if (cancelled) return;
      resetTimer();
    };

    const resetTimer = () => {
      if (logoutTimer.current) window.clearTimeout(logoutTimer.current);
      logoutTimer.current = window.setTimeout(() => {
        logout();
        alert('התנתקת אוטומטית עקב חוסר פעילות.');
      }, minutes * 60 * 1000);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'pointerdown'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    arm();

    return () => {
      cancelled = true;
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (logoutTimer.current) window.clearTimeout(logoutTimer.current);
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
