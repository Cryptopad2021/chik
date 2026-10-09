'use client';

/**
 * Сессия администратора (PHASE 4): login/logout/restore через API-клиент.
 * Статусы: loading → authenticated | anonymous. Никогда не храним токены
 * в localStorage (ТЗ §39) — access живёт в памяти модуля (lib/api.ts).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  restoreSession,
} from '@/lib/api';
import type { SessionUser } from '@/lib/api';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: SessionUser | null;
  status: Status;
  signIn: (email: string, password: string, remember: boolean) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // 1) есть access в памяти (SPA-навигация) → me;
      // 2) иначе пробуем восстановить из httpOnly refresh-cookie.
      const me = await fetchMe();
      if (cancelled) return;
      if (me.ok && me.data) {
        setUser(me.data);
        setStatus('authenticated');
        return;
      }
      const restored = await restoreSession();
      if (cancelled) return;
      setUser(restored);
      setStatus(restored ? 'authenticated' : 'anonymous');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string, remember: boolean) => {
      const res = await apiLogin(email, password, remember);
      if (res.ok && res.data) {
        setUser(res.data);
        setStatus('authenticated');
        return { ok: true };
      }
      return { ok: false, message: res.error?.message ?? 'Не удалось войти' };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(() => ({ user, status, signIn, signOut }), [user, status, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен вызываться внутри <AuthProvider>');
  return ctx;
}
