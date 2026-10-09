'use client';

/**
 * Шапка админки (PHASE 4): имя/роль текущего пользователя + выход.
 * Полная навигация разделов — PHASE 9; здесь минимальный layout-хром.
 */
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Суперадмин',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  CONTENT_MANAGER: 'Контент-менеджер',
  VIEWER: 'Наблюдатель',
};

export function AdminHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function onLogout() {
    await signOut();
    router.replace('/login');
  }

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
      <span className="font-semibold">ЧиркейТур — Админ</span>
      {user && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-700">
            {user.name}{' '}
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
          >
            Выйти
          </button>
        </div>
      )}
    </header>
  );
}
