import Link from 'next/link';
import { ru } from '@/content/ru';
import type { SiteSettingsInfo, DestinationInfo } from '../lib/api';

export function Footer({ settings, destinations }: { settings: SiteSettingsInfo | null; destinations: DestinationInfo[] }) {
  return (
    <footer className="mt-20 border-t border-stone-200 bg-stone-900 text-stone-300">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="font-serif text-lg font-bold text-white">⛰ {settings?.companyName ?? ru.common.brand}</div>
          <p className="mt-3 text-sm leading-relaxed">{settings?.footerText ?? 'Авторские туры по Кавказу: Дагестан, Осетия, Чечня, Ингушетия.'}</p>
        </div>
        <nav aria-label={ru.footer.navigation}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white">{ru.footer.navigation}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/tours" className="hover:text-white">{ru.nav.tours}</Link></li>
            <li><Link href="/reviews" className="hover:text-white">{ru.nav.reviews}</Link></li>
            <li><Link href="/faq" className="hover:text-white">{ru.nav.faq}</Link></li>
            <li><Link href="/about" className="hover:text-white">{ru.nav.about}</Link></li>
            <li><Link href="/contacts" className="hover:text-white">{ru.nav.contacts}</Link></li>
          </ul>
        </nav>
        <nav aria-label={ru.footer.destinations}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white">{ru.footer.destinations}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {destinations.slice(0, 6).map((d) => (
              <li key={d.id}><Link href={`/destinations/${d.slug}`} className="hover:text-white">{d.name}</Link></li>
            ))}
            {destinations.length === 0 ? <li className="text-stone-500">—</li> : null}
          </ul>
        </nav>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white">{ru.footer.contacts}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {settings?.phone ? <li><a href={`tel:${settings.phone}`} className="hover:text-white">{settings.phone}</a></li> : null}
            {settings?.email ? <li><a href={`mailto:${settings.email}`} className="hover:text-white">{settings.email}</a></li> : null}
            {settings?.telegramUrl ? (
              <li><a href={settings.telegramUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-sky-400 hover:text-sky-300">Telegram-канал</a></li>
            ) : null}
            {settings?.address ? <li>{settings.address}</li> : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-700">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs sm:px-6">
          <span>© {new Date().getFullYear()} {settings?.companyName ?? ru.common.brand}</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white">{ru.footer.privacy}</Link>
            <Link href="/terms" className="hover:text-white">{ru.footer.terms}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
