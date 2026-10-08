import type { Metadata } from 'next';
import Link from 'next/link';
import { ru } from '@/content/ru';
import { apiGet, type DestinationInfo } from '../../lib/api';

interface ListResponse<T> { items: T[]; total: number }

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: ru.destinations.title,
    description: 'Направления туров ЧиркейТур: Дагестан, Осетия, Чечня, Ингушетия и другие регионы Кавказа.',
    alternates: { canonical: '/destinations' },
    openGraph: { title: ru.destinations.title, type: 'website' },
  };
}

export default async function DestinationsPage() {
  const res = await apiGet<ListResponse<DestinationInfo>>('destinations', 300);
  const items = res?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-emerald-950 sm:text-4xl">{ru.destinations.title}</h1>

      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
          <p className="text-stone-600">{ru.destinations.empty}</p>
          <Link href="/tours" className="mt-4 inline-block text-sm font-medium text-emerald-800 underline-offset-4 hover:underline">
            {ru.common.ctaPrimary}
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d) => (
            <li key={d.id}>
              <Link
                href={`/destinations/${d.slug}`}
                className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
              >
                {d.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.imageUrl} alt={d.name} className="h-44 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-emerald-800 to-emerald-950 text-3xl text-white/90">⛰</div>
                )}
                <div className="p-5">
                  <h2 className="font-serif text-lg font-semibold text-emerald-950 group-hover:text-emerald-800">{d.name}</h2>
                  {d.description ? <p className="mt-2 line-clamp-3 text-sm text-stone-600">{d.description}</p> : null}
                  {typeof d.toursCount === 'number' ? (
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-stone-500">{ru.destinations.toursInDest(d.toursCount)}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
