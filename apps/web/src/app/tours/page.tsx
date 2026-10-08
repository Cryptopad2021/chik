import type { Metadata } from 'next';
import Link from 'next/link';
import { ru } from '@/content/ru';
import { apiGet, type TourSummary, type DestinationInfo } from '../../lib/api';
import { TourCard } from '../../components/TourCard';

interface ListResponse<T> { items: T[]; total: number }

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: ru.catalog.title,
    description: `${ru.catalog.title}: туры по Дагестану, Осетии, Чечне и Ингушетии с датами выездов и ценами.`,
    alternates: { canonical: '/tours' },
    openGraph: { title: ru.catalog.title, type: 'website' },
  };
}

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  // Shareable URL-фильтры (ТЗ §29): /tours?destination=dagestan&city=rostov&sort=price_asc
  const params = new URLSearchParams();
  for (const key of ['search', 'destination', 'city', 'dateFrom', 'dateTo', 'durationDays', 'minPrice', 'maxPrice', 'sort', 'page'] as const) {
    const v = searchParams[key];
    if (v) params.set(key, v);
  }
  params.set('perPage', '12');

  const [toursRes, destinations] = await Promise.all([
    apiGet<ListResponse<TourSummary>>(`tours?${params.toString()}`, 30),
    apiGet<ListResponse<DestinationInfo>>('destinations', 300).then((r) => r?.items ?? []),
  ]);

  const tours = toursRes?.items ?? [];
  const total = toursRes?.total ?? 0;
  const page = Math.max(1, Number(searchParams.page ?? '1') || 1);
  const totalPages = toursRes ? Math.ceil(total / 12) : 0;

  const buildQuery = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === '') p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `/tours?${s}` : '/tours';
  };

  const selectCls =
    'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700';
  const hasFilters = ['search', 'destination', 'city', 'dateFrom', 'durationDays', 'minPrice', 'maxPrice'].some((k) => params.get(k));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-emerald-950 sm:text-4xl">{ru.catalog.title}</h1>

      {/* Фильтры — GET-форма → shareable URL (ТЗ §29) */}
      <form method="get" action="/tours" className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        <label className="col-span-2 block sm:col-span-3 lg:col-span-2">
          <span className="mb-1 block text-xs font-medium text-stone-500">{ru.common.searchPlaceholder}</span>
          <input name="search" type="search" defaultValue={searchParams.search ?? ''} className={`${selectCls} w-full`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500">{ru.catalog.destination}</span>
          <select name="destination" defaultValue={searchParams.destination ?? ''} className={`${selectCls} w-full`}>
            <option value="">—</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.slug}>{d.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500">{ru.catalog.sort}</span>
          <select name="sort" defaultValue={searchParams.sort ?? ''} className={`${selectCls} w-full`}>
            <option value="">{ru.catalog.sortRelevance}</option>
            <option value="price_asc">{ru.catalog.sortPriceAsc}</option>
            <option value="price_desc">{ru.catalog.sortPriceDesc}</option>
            <option value="newest">{ru.catalog.sortNewest}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500">{ru.catalog.dateFrom}</span>
          <input name="dateFrom" type="date" defaultValue={searchParams.dateFrom ?? ''} className={`${selectCls} w-full`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500">{ru.catalog.priceFrom}</span>
          <input name="minPrice" type="number" min={0} step={1000} placeholder="₽" defaultValue={searchParams.minPrice ?? ''} className={`${selectCls} w-full`} />
        </label>
        <div className="col-span-2 flex items-center gap-3 sm:col-span-3 lg:col-span-2">
          <button type="submit" className="rounded-full bg-emerald-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
            {ru.catalog.filters}
          </button>
          {hasFilters && (
            <Link href="/tours" className="text-sm text-stone-500 underline-offset-2 hover:underline">{ru.catalog.reset}</Link>
          )}
        </div>
      </form>

      <p className="mt-4 text-sm text-stone-500" aria-live="polite">{ru.catalog.found(total)}</p>

      {tours.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-stone-600">{hasFilters ? ru.catalog.empty : ru.common.emptyTours}</p>
          {hasFilters && (
            <Link href="/tours" className="mt-4 inline-block text-sm font-medium text-emerald-800 hover:underline">{ru.catalog.reset}</Link>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tours.map((t) => (
            <TourCard key={t.id} tour={t} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label={ru.catalog.title} className="mt-10 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={buildQuery({ page: String(page - 1) })} className="rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100">←</Link>
          )}
          <span className="px-2 text-sm text-stone-600">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link href={buildQuery({ page: String(page + 1) })} className="rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100">→</Link>
          )}
        </nav>
      )}
    </div>
  );
}
