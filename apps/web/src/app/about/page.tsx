import type { Metadata } from 'next';
import Link from 'next/link';
import { ru } from '@/content/ru';
import { apiGet, type SiteSettingsInfo } from '../../lib/api';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${ru.about.title} — ЧиркейТур`,
    description: 'ЧиркейТур — авторские туры по Кавказу: Дагестан, Осетия, Чечня, Ингушетия. Малые группы, местные гиды.',
    alternates: { canonical: '/about' },
  };
}

export default async function AboutPage() {
  const s = await apiGet<SiteSettingsInfo>('settings/public', 300);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-emerald-950 sm:text-4xl">{ru.about.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-stone-800">{s?.heroTitle ?? ru.about.lead}</p>
      <p className="mt-4 leading-relaxed text-stone-600">{ru.about.text}</p>

      <ul className="mt-8 space-y-3 text-stone-700">
        <li className="flex gap-2"><span aria-hidden="true">⛰</span> Маршруты по горам Кавказа с проверенными гидами</li>
        <li className="flex gap-2"><span aria-hidden="true">🚌</span> Трансфер из городов отправления: Ростов-на-Дону и другие</li>
        <li className="flex gap-2"><span aria-hidden="true">👥</span> Малые группы и продуманная программа по дням</li>
        <li className="flex gap-2"><span aria-hidden="true">✍️</span> Анонсы выездов в Telegram: {s?.telegramUrl ? <a href={s.telegramUrl} className="text-emerald-800 underline">{ru.common.brand}</a> : 'ссылка появится в настройках'}</li>
      </ul>

      <p className="mt-8 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">{ru.about.legalNote}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/tours" className="rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">{ru.common.ctaPrimary}</Link>
        <Link href="/contacts" className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50">{ru.nav.contacts}</Link>
      </div>
    </div>
  );
}
