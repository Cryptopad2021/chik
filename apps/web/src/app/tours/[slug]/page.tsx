import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ru } from '@/content/ru';
import { apiGet, type TourFull, type FaqInfo, type ReviewInfo } from '../../../lib/api';
import { formatPrice, formatDate, formatDuration, seatsLabel } from '../../../lib/format';
import { ReviewCard } from '../../../components/ReviewCard';

interface ListResponse<T> { items: T[]; total: number }

export const revalidate = 30;

async function loadTour(slug: string): Promise<TourFull | null> {
  return apiGet<TourFull>(`tours/${slug}`, 30);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tour = await loadTour(params.slug);
  if (!tour) return { title: ru.notFound.title };
  const title = tour.metaTitle ?? tour.title;
  const description = tour.metaDescription ?? tour.shortDescription ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: `/tours/${tour.slug}` },
    openGraph: {
      title,
      description,
      type: 'article',
      images: tour.coverImage ? [{ url: tour.coverImage }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** JSON-LD Product (ТЗ §30) — только реальные данные со страницы */
function tourJsonLd(tour: TourFull, siteUrl: string): string {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: tour.title,
    description: tour.shortDescription ?? tour.description ?? undefined,
    offers: {
      '@type': 'Offer',
      price: tour.basePrice,
      priceCurrency: tour.currency,
      availability: 'https://schema.org/InStock',
      url: `${siteUrl}/tours/${tour.slug}`,
    },
  };
  if (tour.coverImage) ld.image = tour.coverImage;
  return JSON.stringify(ld);
}

export default async function TourPage({ params }: { params: { slug: string } }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const tour = await loadTour(params.slug);
  if (!tour) notFound();

  const faqRes = await apiGet<ListResponse<FaqInfo>>('faq', 300);
  const reviews: ReviewInfo[] = tour.reviews ?? [];
  const openDepartures = tour.departures.filter((d) => d.status === 'OPEN' || d.status === 'ALMOST_FULL');
  const duration = formatDuration(tour.durationDays, tour.durationNights);
  const allCities = Array.from(new Map(openDepartures.flatMap((d) => d.cities ?? []).map((c) => [c.id, c])).values());

  return (
    <article>
      {/* Hero */}
      <header className="relative h-[320px] w-full overflow-hidden bg-emerald-950 sm:h-[420px]">
        {tour.coverImage ? (
          <Image src={tour.coverImage} alt={tour.title} fill className="object-cover opacity-80" priority sizes="100vw" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-8 sm:px-6">
          <nav aria-label="breadcrumb" className="mb-2 text-sm text-emerald-100">
            <Link href="/" className="hover:underline">{ru.common.brand}</Link>{' '}›{' '}
            <Link href="/tours" className="hover:underline">{ru.nav.tours}</Link>{' '}›{' '}
            <span aria-current="page">{tour.title}</span>
          </nav>
          <h1 className="font-serif text-3xl font-bold text-white sm:text-4xl">{tour.title}</h1>
          <p className="mt-1 text-emerald-100">
            {tour.destination ? (
              <>
                <Link href={`/destinations/${tour.destination.slug}`} className="hover:underline">{tour.destination.name}</Link>
                {' · '}
              </>
            ) : null}
            {duration ?? ''}
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {tour.shortDescription ? <p className="text-lg text-stone-700">{tour.shortDescription}</p> : null}
          {tour.description ? (
            <div className="mt-4 whitespace-pre-line text-stone-700">{tour.description}</div>
          ) : null}

          {/* Программа по дням (ТЗ §9, §28) */}
          {tour.days.length > 0 && (
            <section className="mt-10" id="program">
              <h2 className="font-serif text-2xl font-bold text-emerald-950">{ru.tour.program}</h2>
              <ol className="mt-4 space-y-4">
                {tour.days.map((d) => (
                  <li key={d.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <h3 className="font-semibold text-emerald-900">{ru.tour.dayLabel(d.dayNumber)} — {d.title}</h3>
                    {d.description ? <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{d.description}</p> : null}
                    {(d.meals || d.overnight) && (
                      <p className="mt-2 text-xs text-stone-500">
                        {d.meals ? `Питание: ${d.meals}. ` : ''}{d.overnight ? 'Ночёвка в программе.' : 'Без ночёвки.'}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(tour.includedText || tour.notIncludedText) && (
            <section className="mt-10 grid gap-4 sm:grid-cols-2">
              {tour.includedText ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                  <h2 className="font-semibold text-emerald-900">✔ {ru.tour.included}</h2>
                  <p className="mt-2 whitespace-pre-line text-sm text-emerald-950">{tour.includedText}</p>
                </div>
              ) : null}
              {tour.notIncludedText ? (
                <div className="rounded-xl border border-stone-200 bg-white p-5">
                  <h2 className="font-semibold text-stone-700">✖ {ru.tour.notIncluded}</h2>
                  <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{tour.notIncludedText}</p>
                </div>
              ) : null}
            </section>
          )}

          {tour.images.length > 1 && (
            <section className="mt-10" id="gallery">
              <h2 className="font-serif text-2xl font-bold text-emerald-950">{ru.tour.gallery}</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {tour.images.map((img, i) => (
                  <div key={img.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-200">
                    <Image src={img.url} alt={img.alt ?? `${tour.title} — фото ${i + 1}`} fill className="object-cover" loading="lazy" sizes="(max-width: 640px) 50vw, 33vw" />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10" id="reviews">
            <h2 className="font-serif text-2xl font-bold text-emerald-950">{ru.tour.reviews}</h2>
            {reviews.length === 0 ? (
              <p className="mt-3 text-stone-500">{ru.reviews.empty}</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {reviews.slice(0, 6).map((r) => (<ReviewCard key={r.id} review={r} />))}
              </div>
            )}
            <Link href={`/reviews#leave`} className="mt-3 inline-block text-sm font-medium text-emerald-800 hover:underline">{ru.reviews.leave}</Link>
          </section>

          {(faqRes?.items?.length ?? 0) > 0 && (
            <section className="mt-10" id="faq">
              <h2 className="font-serif text-2xl font-bold text-emerald-950">{ru.faq.title}</h2>
              <div className="mt-4 space-y-2">
                {faqRes!.items.slice(0, 6).map((f) => (
                  <details key={f.id} className="rounded-xl border border-stone-200 bg-white p-4">
                    <summary className="cursor-pointer font-medium text-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">{f.question}</summary>
                    <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar: цена + даты + CTA (ТЗ §28) */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-md">
            <p className="text-sm text-stone-500">{ru.common.from}</p>
            <p className="text-3xl font-bold text-emerald-900">{formatPrice(tour.basePrice, tour.currency)}</p>
            {duration ? <p className="mt-1 text-sm text-stone-500">{duration}</p> : null}

            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-stone-500">{ru.tour.dates}</h2>
            {openDepartures.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">{ru.tour.noDates}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {openDepartures.slice(0, 5).map((d) => (
                  <li key={d.id} className="rounded-xl border border-stone-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-stone-800">{formatDate(d.startDate)}</span>
                      <span className="text-sm font-semibold text-emerald-800">{formatPrice(d.price, tour.currency)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className={d.availableSeats <= 4 ? 'text-amber-700' : 'text-stone-500'}>
                        {d.availableSeats > 0 ? seatsLabel(d.availableSeats) : ru.tour.full}
                      </span>
                      {d.cities?.length ? <span className="truncate text-stone-400">{d.cities.map((c) => c.name).join(', ')}</span> : null}
                    </div>
                    {d.availableSeats > 0 ? (
                      <Link
                        href={`/booking/${tour.slug}?departure=${d.id}`}
                        className="mt-2 block rounded-full bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-stone-900 transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                      >
                        {ru.tour.bookNow}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {allCities.length > 0 && (
              <>
                <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-stone-500">{ru.tour.departureCities}</h2>
                <ul className="mt-2 list-inside list-disc text-sm text-stone-600">
                  {allCities.map((c) => (<li key={c.id}>{c.name}</li>))}
                </ul>
              </>
            )}
          </div>
        </aside>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: tourJsonLd(tour, siteUrl) }} />
    </article>
  );
}
