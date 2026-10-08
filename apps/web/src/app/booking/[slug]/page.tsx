import type { Metadata } from 'next';
import Link from 'next/link';
import { ru } from '@/content/ru';
import { apiGet, type TourFull } from '../../../lib/api';
import { BookingWizard } from '../../../components/BookingWizard';
import { BookingStatusLookup } from '../../../components/BookingStatusLookup';

export const revalidate = 30;

export const metadata: Metadata = { title: `${ru.booking.title} — ЧиркейТур`, robots: { index: false } };

/**
 * Единая динамическая страница /booking/<value>:
 *  - <value> = slug тура → пошаговый wizard бронирования (ТЗ §15, §26, §69);
 *  - <value> = номер заявки (содержит «-») → проверка статуса (ТЗ §26 /booking/[id]).
 */
export default async function BookingPage({ params }: { params: { slug: string } }) {
  const raw = decodeURIComponent(params.slug);

  // Заявка: номер вида CHT-XXXXXX
  if (raw.includes('-')) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-serif text-3xl font-bold text-emerald-950">{ru.booking.statusTitle}</h1>
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <BookingStatusLookup initialNumber={raw} />
        </div>
      </div>
    );
  }

  const tour = await apiGet<TourFull>(`tours/${raw}`, 10);
  if (!tour || !Array.isArray(tour.departures)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold text-emerald-950">{ru.notFound.title}</h1>
        <p className="mt-2 text-stone-600">{ru.notFound.text}</p>
        <Link href="/tours" className="mt-6 inline-block rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">
          {ru.nav.tours}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-emerald-950">{ru.booking.title}</h1>
      <p className="mt-1 text-sm text-stone-500">{tour.title}</p>
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <BookingWizard key={tour.id} tour={tour} />
      </div>
    </div>
  );
}

