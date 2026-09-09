import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui';

/**
 * Back-navigation guard.
 *
 * A screen with unsaved in-memory state registers a guard (a dirty-check and an
 * optional save handler). The shared back button routes through `attemptBack`:
 * when the current screen is dirty it opens a confirm dialog
 * ("יש שינויים שלא נשמרו…") instead of leaving immediately, so nothing typed
 * is lost by accident. Back is always in-app history (never logout).
 */
interface Guard {
  isDirty: () => boolean;
  save?: () => Promise<void>;
}

interface NavGuardState {
  setGuard: (g: Guard | null) => void;
  attemptBack: () => void;
}

const NavGuardContext = createContext<NavGuardState | undefined>(undefined);

export function NavGuardProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const guardRef = useRef<Guard | null>(null);
  const [activeGuard, setActiveGuard] = useState<Guard | null>(null);
  const [busy, setBusy] = useState(false);

  const setGuard = useCallback((g: Guard | null) => {
    guardRef.current = g;
  }, []);

  const goBack = useCallback(() => {
    guardRef.current = null;
    // In-app history step. Fall back to home if there is nowhere to go back to.
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }, [navigate]);

  const attemptBack = useCallback(() => {
    const g = guardRef.current;
    if (g && g.isDirty()) setActiveGuard(g);
    else goBack();
  }, [goBack]);

  const stay = () => setActiveGuard(null);
  const leave = () => {
    setActiveGuard(null);
    goBack();
  };
  const saveAndBack = async () => {
    if (!activeGuard?.save) return;
    setBusy(true);
    try {
      await activeGuard.save();
      setActiveGuard(null);
      goBack();
    } finally {
      setBusy(false);
    }
  };

  return (
    <NavGuardContext.Provider value={{ setGuard, attemptBack }}>
      {children}
      <Modal
        open={!!activeGuard}
        onClose={stay}
        title="שינויים שלא נשמרו"
        tone="lock"
        icon="alert"
        maxWidth="max-w-md"
      >
        <p className="text-slate-600">
          יש שינויים שלא נשמרו במסך זה. האם לצאת מהמסך?
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="btn-ghost flex-1" onClick={stay} disabled={busy}>
            הישאר במסך
          </button>
          {activeGuard?.save && (
            <button className="btn-primary flex-1" onClick={saveAndBack} disabled={busy}>
              שמור וחזור
            </button>
          )}
          <button className="btn-danger flex-1" onClick={leave} disabled={busy}>
            צא ללא שמירה
          </button>
        </div>
      </Modal>
    </NavGuardContext.Provider>
  );
}

export function useNavGuard(): NavGuardState {
  const ctx = useContext(NavGuardContext);
  if (!ctx) throw new Error('useNavGuard must be used within NavGuardProvider');
  return ctx;
}

/**
 * Register the current screen's unsaved-changes guard for the lifetime of the
 * component. `isDirty` is read live; `save`, if given, powers "שמור וחזור".
 */
export function useUnsavedGuard(isDirty: () => boolean, save?: () => Promise<void>) {
  const { setGuard } = useNavGuard();
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const saveRef = useRef(save);
  saveRef.current = save;
  const hasSave = !!save;

  useEffect(() => {
    setGuard({
      isDirty: () => isDirtyRef.current(),
      save: hasSave ? async () => saveRef.current?.() : undefined,
    });
    return () => setGuard(null);
  }, [setGuard, hasSave]);
}
