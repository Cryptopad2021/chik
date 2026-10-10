'use client';

/**
 * Sidebar админ-панели (ТЗ §18, PHASE 9.2).
 * Пункты, для которых UI ещё не построен, ведут на /coming-soon (страницы
 * появятся в ходе PHASE 9); доступные разделы фильтруются по роли (§7).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { roleAllows, type Role } from '@/lib/permissions';

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  roles?: Role[]; // undefined = все роли
}

const svg = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden>
    <path d={d} />
  </svg>
);

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Дашборд', icon: svg('M3 12l9-9 9 9M5 10v10h14V10') },
  { href: '/bookings', label: 'Заявки', icon: svg('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'), roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { href: '/customers', label: 'Клиенты', icon: svg('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'), roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { href: '/tours', label: 'Туры', icon: svg('M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18 15 15 0 010-18') },
  { href: '/departures', label: 'Выезды', icon: svg('M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z') },
  { href: '/destinations', label: 'Направления', icon: svg('M9 20l-5.5-2.5v-11L9 9m0 11l6-2.5m-6 2.5V9m6 8.5L21.5 20V9L15 11.5M15 4.5L9 6.5m6-2L21.5 9M15 4.5V11.5') },
  { href: '/cities', label: 'Города отправления', icon: svg('M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01') },
  { href: '/hero', label: 'Карусель главной', icon: svg('M4 16l3.5-4.5 3 3.5L14 11l6 5H4zm0 0M4 5h16v14H4z') },
  { href: '/reviews', label: 'Отзывы', icon: svg('M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.7 9.7 0 01-4-.8L3 20l1.3-3.9A7.9 7.9 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z') },
  { href: '/media', label: 'Медиабиблиотека', icon: svg('M4 16l3.5-4.5 3 3.5L14 11l6 5M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM10 9h.01') },
  { href: '/faq', label: 'FAQ', icon: svg('M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3m0 3h.01M12 22a10 10 0 100-20 10 10 0 000 20z') },
  { href: '/settings', label: 'Настройки сайта', icon: svg('M10.3 4.3a1.7 1.7 0 013.4 0 1.7 1.7 0 002.6 1.1 1.7 1.7 0 012.4 2.4 1.7 1.7 0 001 2.5 1.7 1.7 0 010 3.4 1.7 1.7 0 00-1 2.6 1.7 1.7 0 01-2.5 2.4 1.7 1.7 0 00-2.4 1 1.7 1.7 0 01-3.4 0 1.7 1.7 0 00-2.6-1 1.7 1.7 0 01-2.4-2.5 1.7 1.7 0 00-1-2.5 1.7 1.7 0 010-3.4 1.7 1.7 0 001-2.6 1.7 1.7 0 012.5-2.4 1.7 1.7 0 002.4-1zM12 15a3 3 0 100-6 3 3 0 000 6z'), roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/users', label: 'Пользователи', icon: svg('M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 3.13a4 4 0 010 7.75M12 7a4 4 0 11-8 0 4 4 0 018 0z'), roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/audit', label: 'Журнал действий', icon: svg('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'), roles: ['SUPER_ADMIN', 'ADMIN'] },
];

/** Разделы, готовые в текущей сборке (остальные — заглушки до конца PHASE 9). */
const READY_HREFS = new Set([
  '/dashboard',
  '/bookings',
  '/customers',
  '/tours',
  '/departures',
  '/destinations',
  '/cities',
  '/hero',
  '/reviews',
  '/media',
  '/faq',
  '/settings',
  '/users',
  '/audit',
]);

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="flex w-full flex-col border-r border-neutral-200 bg-white lg:w-60 lg:shrink-0" aria-label="Разделы админки">
      <nav>
        <ul className="flex flex-wrap gap-1 p-2 lg:flex-col lg:flex-nowrap">
          {NAV_ITEMS.filter((item) => roleAllows(user?.role, item.roles ?? [])).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const ready = READY_HREFS.has(item.href);
            const cls =
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ' +
              (active ? 'bg-brand-50 font-medium text-brand-700' : 'text-neutral-700 hover:bg-neutral-100');
            const inner = (
              <>
                {item.icon}
                <span className={ready ? '' : 'text-neutral-500'}>{item.label}</span>
                {!ready && <span className="ml-auto hidden rounded bg-neutral-100 px-1 text-[10px] uppercase text-neutral-400 lg:inline">скоро</span>}
              </>
            );
            return (
              <li key={item.href}>
                {ready ? (
                  <Link href={item.href} className={cls} aria-current={active ? 'page' : undefined}>
                    {inner}
                  </Link>
                ) : (
                  <Link href={`/coming-soon?section=${encodeURIComponent(item.label)}`} className={cls}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
