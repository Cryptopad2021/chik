import type { Metadata } from 'next';
import Link from 'next/link';
import { ru } from '@/content/ru';
import { apiGet, type ReviewInfo } from '../../lib/api';
import { ReviewCard } from '../../components/ReviewCard';
import { ReviewForm } from '../../components/ReviewForm';
import { Breadcrumbs } from '../../components/Breadcrumbs';
import { aggregateRatingLd, reviewItemsLd, breadcrumbLd, jsonLdScript } from '../../lib/seo';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: ru.reviews.title,
    description: 'Отзывы путешественников о турах ЧиркейТур по Кавказу. Публикуются после модерации.',
    alternates: { canonical: '/reviews' },
  };
}

export default async function ReviewsPage() {
  const reviews = await apiGet<ReviewInfo[]>('reviews', 30);
  const items = reviews ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ name: 'Главная', href: '/' }, { name: ru.reviews.title }]} />
      <h1 className="mt-2 font-serif text-3xl font-bold text-emerald-950 sm:text-4xl">{ru.reviews.title}</h1>

      {items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-stone-600">
          {ru.reviews.empty}
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => <li key={r.id}><ReviewCard review={r} /></li>)}
        </ul>
      )}

      <section className="mt-12 max-w-xl" aria-labelledby="review-form-title">
        <h2 id="review-form-title" className="text-xl font-semibold text-emerald-950">{ru.reviews.leave}</h2>
        <ReviewForm />
      </section>

      {/* JSON-LD: рейтинг и отзывы — только по реальным опубликованным отзывам (§13.5) */}
      {(() => {
        const mapped = items.map((r) => ({
          rating: r.rating,
          authorName: r.customer ? `${r.customer.firstName}${r.customer.lastName ? ` ${r.customer.lastName}` : ''}` : null,
          comment: r.text,
          createdAt: r.createdAt,
        }));
        const rating = aggregateRatingLd(mapped);
        if (!rating) return null;
        const ld = {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: ru.reviews.title,
          url: `${SITE_URL}/reviews`,
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: reviewItemsLd(mapped).map((rv, i) => ({ '@type': 'ListItem', position: i + 1, item: rv })),
          },
          ...{ 'about': { '@id': SITE_URL } },
          aggregateRating: rating,
        };
        return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ld) }} />;
      })()}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(breadcrumbLd(SITE_URL, [{ name: 'Главная', url: '/' }, { name: ru.reviews.title, url: '/reviews' }])),
        }}
      />
    </div>
  );
}
