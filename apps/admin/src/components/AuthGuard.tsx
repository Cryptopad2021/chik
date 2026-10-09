'use client';

/**
 * Защита приватных страниц админки (PHASE 4): пока сессия не подтверждена —
 * spinner; anonymous — редирект на /login. RBAC-фильтрация UI — по lib/permissions,
 * но окончательные права проверяет backend (guards).
 */
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center text-neutral-500">
        Загрузка…
      </main>
    );
  }
  if (status === 'anonymous') return null; // до редиректа ничего не показываем
  return <>{children}</>;
}
