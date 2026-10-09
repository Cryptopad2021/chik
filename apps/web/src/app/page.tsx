import Link from 'next/link';
import { ru } from '@/content/ru';
import { apiGet, type TourSummary, type DestinationInfo, type ReviewInfo, type FaqInfo, type SiteSettingsInfo } from '../lib/api';
import { TourCard } from '../components/TourCard';
import { ReviewCard } from '../components/ReviewCard';
import { HeroCarousel, type HeroSlideData } from '../components/HeroCarousel';

interface ListResponse<T> { items: T[]; total: number }

export default async function HomePage() {
  const [toursRes, destinations, reviews, faq, settings, heroSlides] = await Promise.all([
    apiGet<ListResponse<TourSummary>>('tours?perPage=6&sort=newest', 60),
    apiGet<ListResponse<DestinationInfo>>('destinations', 300).then((r) => r?.items ?? []),
    apiGet<ListResponse<ReviewInfo>>('reviews', 120).then((r) => r?.items ?? []),
    apiGet<ListResponse<FaqInfo>>('faq', 300).then((r) => r?.items ?? []),
    apiGet<SiteSettingsInfo>('settings/public', 300),
    apiGet<HeroSlideData[]>('destinations/hero', 300).then((r) => r ?? []),
  ]);
  const tours = toursRes?.items ?? [];
  const destList = destinations;
  const reviewList = reviews;
  const faqList = faq;

  return (
    <>
      {/* Карусель сразу под верхним меню — слайды управляются из админки (§48) */}
      {heroSlides.length > 0 ? <HeroCarousel slides={heroSlides} /> : null}

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-800 text-white">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
          <h1 className="max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            {settings?.heroTitle ?? ru.home.heroTitle}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-emerald-100">{settings?.heroDescription ?? ru.home.heroSubtitle}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/tours" className="rounded-full bg-amber-500 px-8 py-3.5 font-semibold text-stone-900 shadow-lg transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400">
              {ru.common.ctaPrimary}
            </Link>
            {settings?.telegramUrl ? (
              <a href={settings.telegramUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/40 px-8 py-3.5 font-semibold text-white transition hover:bg-white/10">
                {ru.common.telegramCta}
              </a>
            ) : (
              <Link href="/contacts" className="rounded-full border border-white/40 px-8 py-3.5 font-semibold text-white transition hover:bg-white/10">
                {ru.common.ctaSecondary}
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Популярные направления */}
        {destList.length > 0 ? (
          <section className="mt-16" aria-labelledby="dest-h">
            <h2 id="dest-h" className="font-serif text-2xl font-bold sm:text-3xl">{ru.home.popularDestinations}</h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {destList.slice(0, 5).map((d) => (
                <Link key={d.id} href={`/destinations/${d.slug}`} className="group rounded-2xl border border-stone-200 bg-white p-5 text-center shadow-sm transition hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
                  <div className="text-3xl" aria-hidden>🏔</div>
                  <div className="mt-2 font-semibold text-stone-900 group-hover:text-emerald-800">{d.name}</div>
                  {typeof d.toursCount === 'number' ? <div className="mt-1 text-xs text-stone-500">{d.toursCount} тур(ов)</div> : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Ближайшие туры */}
        <section className="mt-16" aria-labelledby="tours-h">
          <div className="flex items-end justify-between">
            <h2 id="tours-h" className="font-serif text-2xl font-bold sm:text-3xl">{ru.home.upcomingTours}</h2>
            <Link href="/tours" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Все туры →</Link>
          </div>
          {tours.length === 0 ? (
            <EmptyState text={ru.common.emptyTours} telegramUrl={settings?.telegramUrl} />
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tours.map((t) => <TourCard key={t.id} tour={t} />)}
            </div>
          )}
        </section>

        {/* Почему выбирают нас */}
        <section className="mt-16 rounded-3xl bg-emerald-50 p-8 sm:p-12" aria-labelledby="why-h">
          <h2 id="why-h" className="font-serif text-2xl font-bold sm:text-3xl">{ru.home.whyUs}</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(parseAdvantages(settings?.advantages)).map((a) => (
              <div key={a.title}>
                <div className="text-2xl" aria-hidden>{a.icon}</div>
                <h3 className="mt-2 font-semibold">{a.title}</h3>
                <p className="mt-1 text-sm text-stone-600">{a.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Как проходит поездка */}
        <section className="mt-16" aria-labelledby="how-h">
          <h2 id="how-h" className="font-serif text-2xl font-bold sm:text-3xl">{ru.home.howItWorks}</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {parseSteps(settings?.howItWorks).map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-stone-200 bg-white p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">{i + 1}</span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-stone-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Отзывы */}
        {reviewList.length > 0 ? (
          <section className="mt-16" aria-labelledby="rev-h">
            <div className="flex items-end justify-between">
              <h2 id="rev-h" className="font-serif text-2xl font-bold sm:text-3xl">{ru.home.reviewsTitle}</h2>
              <Link href="/reviews" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Все отзывы →</Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {reviewList.slice(0, 3).map((r) => <ReviewCard key={r.id} review={r} />)}
            </div>
          </section>
        ) : null}

        {/* FAQ */}
        {faqList.length > 0 ? (
          <section className="mt-16" aria-labelledby="faq-h">
            <div className="flex items-end justify-between">
              <h2 id="faq-h" className="font-serif text-2xl font-bold sm:text-3xl">{ru.home.faqTitle}</h2>
              <Link href="/faq" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Все вопросы →</Link>
            </div>
            <div className="mt-6 space-y-3">
              {faqList.slice(0, 4).map((f) => (
                <details key={f.id} className="group rounded-xl border border-stone-200 bg-white p-4">
                  <summary className="cursor-pointer list-none font-medium marker:hidden">{f.question}</summary>
                  <p className="mt-2 text-sm text-stone-600">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        {/* CTA */}
        <section className="mt-16 rounded-3xl bg-emerald-900 p-8 text-center text-white sm:p-12">
          <h2 className="font-serif text-2xl font-bold sm:text-3xl">{ru.home.ctaBlock}</h2>
          <p className="mx-auto mt-3 max-w-xl text-emerald-100">{ru.home.ctaBlockText}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link href="/tours" className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-stone-900 transition hover:bg-amber-400">{ru.common.ctaPrimary}</Link>
            {settings?.telegramUrl ? (
              <a href={settings.telegramUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/40 px-8 py-3 font-semibold transition hover:bg-white/10">{ru.common.telegramCta}</a>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}

function EmptyState({ text, telegramUrl }: { text: string; telegramUrl?: string | null }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
      <div className="text-4xl" aria-hidden>🗺</div>
      <p className="mt-3 text-stone-600">{text}</p>
      {telegramUrl ? <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-full bg-sky-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-sky-700">{ru.common.telegramCta}</a> : null}
    </div>
  );
}


function parseAdvantages(json: unknown): { icon: string; title: string; text: string }[] {
  const fallback = [
    { icon: '🧭', title: 'Проверенные маршруты', text: 'Каждую программу наши гиды проходят лично.' },
    { icon: '🚌', title: 'Комфортный трансфер', text: 'Транспорт, встреча и сопровождение включены.' },
    { icon: '🏔', title: 'Локальные гиды', text: 'Местные жители знают горы и историю лучше всех.' },
    { icon: '🤝', title: 'Маленькие группы', text: 'Не более 18–20 человек в группе.' },
  ];
  if (Array.isArray(json) && json.length > 0) {
    return json.filter((x) => x && typeof x === 'object').slice(0, 4).map((x) => ({ icon: String(x.icon ?? '⭐'), title: String(x.title ?? ''), text: String(x.text ?? '') }));
  }
  return fallback;
}

function parseSteps(json: unknown): { title: string; text: string }[] {
  const fallback = [
    { title: 'Выбираете тур и дату', text: 'В каталоге или через менеджера.' },
    { title: 'Оставляете заявку', text: 'Имя, телефон — и номер заявки сразу на экране.' },
    { title: 'Подтверждение и оплата', text: 'Менеджер связывается, фиксируем места.' },
    { title: 'Поездка', text: 'Встреча в городе отправления — и в путь.' },
  ];
  if (Array.isArray(json) && json.length > 0) {
    return json.filter((x) => x && typeof x === 'object').map((x) => ({ title: String(x.title ?? ''), text: String(x.text ?? '') }));
  }
  return fallback;
}

