import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ru } from '@/content/ru';
import { apiGet, type TourSummary } from '../../../lib/api';
import { TourCard } from '../../../components/TourCard';

interface DestinationFull {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tours: TourSummary[];
}

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const d = await apiGet<DestinationFull>(`destinations/${params.slug}`, 300);
  if (!d) return { title: `${ru.destinations.title}` };
  return {
    title: `${ru.destinations.title}: ${d.name} — ЧиркейТур`,
    description: d.description ?? `Туры по направлению «${d.name}» с датами выездов и ценами.`,
    alternates: { canonical: `/destinations/${d.slug}` },
    openGraph: { title: `${d.name} — туры`, description: d.description ?? undefined, type: 'website' },
  };
}

export default async function DestinationPage({ params }: { params: { slug: string } }) {
  const d = await apiGet<DestinationFull>(`destinations/${params.slug}`, 300);
  if (!d) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav aria-label="breadcrumb" className="text-sm text-stone-500">
        <ol className="flex flex-wrap gap-1">
          <li><Link href="/" className="hover:text-emerald-800">Главная</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/destinations" className="hover:text-emerald-800">{ru.destinations.title}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-stone-800">{d.name}</li>
        </ol>
      </nav>

      <h1 className="mt-4 font-serif text-3xl font-bold text-emerald-950 sm:text-4xl">{d.name}</h1>
      {d.description ? <p className="mt-3 max-w-3xl text-stone-600">{d.description}</p> : null}

      <h2 className="mt-10 text-xl font-semibold text-emerald-950">{ru.catalog.title}</h2>
      {d.tours.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
          <p className="text-stone-600">{ru.common.emptyTours}</p>
          <Link href="/tours" className="mt-4 inline-block text-sm font-medium text-emerald-800 underline-offset-4 hover:underline">
            Все туры
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.tours.map((t) => (
            <li key={t.id}><TourCard tour={t} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
