import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Toast } from '@/components/ui';

type Kind = 'ok' | 'error' | 'info';
interface ToastState {
  notify: (message: string, kind?: Kind) => void;
}

const ToastContext = createContext<ToastState | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; kind: Kind } | null>(null);

  const notify = useCallback((message: string, kind: Kind = 'info') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
