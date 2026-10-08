import Link from 'next/link';
import { ru } from '@/content/ru';

const links = [
  { href: '/tours', label: ru.nav.tours },
  { href: '/destinations', label: ru.nav.destinations },
  { href: '/reviews', label: ru.nav.reviews },
  { href: '/faq', label: ru.nav.faq },
  { href: '/about', label: ru.nav.about },
  { href: '/contacts', label: ru.nav.contacts },
];

export function Header({ telegramUrl }: { telegramUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-md font-serif text-xl font-bold text-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
          <span aria-hidden>⛰</span> {ru.common.brand}
        </Link>
        <nav aria-label={ru.nav.tours} className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {telegramUrl ? (
            <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="hidden rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 sm:block">
              {ru.common.telegramCta}
            </a>
          ) : null}
          <Link href="/tours" className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
            {ru.common.ctaPrimary}
          </Link>
        </div>
      </div>
      <nav aria-label="mobile" className="flex gap-1 overflow-x-auto border-t border-stone-100 px-4 py-2 md:hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-stone-700 hover:bg-emerald-50">
            {l.label}
          </Link>
        ))}
        {telegramUrl ? (
          <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-sky-700">
            Telegram
          </a>
        ) : null}
      </nav>
    </header>
  );
}
