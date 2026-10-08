import Link from 'next/link';
import type { TourSummary } from '../lib/api';
import { formatPrice, formatDate } from '../lib/format';
import { ru } from '@/content/ru';

export function TourCard({ tour }: { tour: TourSummary }) {
  const cover = tour.coverImage;
  return (
    <article className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md">
      <Link href={`/tours/${tour.slug}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700" aria-label={tour.title}>
        <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-emerald-100 to-stone-200">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={tour.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl" aria-hidden>⛰</div>
          )}
          {tour.durationDays ? (
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-stone-800">
              {ru.common.daysNights(tour.durationDays, tour.durationNights ?? 0)}
            </span>
          ) : null}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-lg font-semibold text-stone-900 group-hover:text-emerald-800">{tour.title}</h3>
            <div className="whitespace-nowrap text-right">
              <div className="text-xs text-stone-500">{ru.common.from}</div>
              <div className="font-semibold text-emerald-800">{formatPrice(tour.basePrice, tour.currency)}</div>
            </div>
          </div>
          {tour.destination?.name ? <p className="mt-1 text-sm text-stone-500">{tour.destination.name}</p> : null}
          {tour.shortDescription ? <p className="mt-2 line-clamp-2 text-sm text-stone-600">{tour.shortDescription}</p> : null}
          {tour.nextDeparture ? (
            <p className="mt-3 text-sm font-medium text-stone-700">
              📅 {formatDate(tour.nextDeparture.startDate)} · {ru.common.seatsLeft(tour.nextDeparture.availableSeats)}
            </p>
          ) : (
            <p className="mt-3 text-sm text-stone-400">{ru.tour.noDates}</p>
          )}
        </div>
      </Link>
    </article>
  );
}
