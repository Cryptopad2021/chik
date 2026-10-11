/**
 * SEO-хелперы (ТЗ §30, Phase 13): JSON-LD микроразметка.
 * Правило §13.5: никаких ложных данных — AggregateRating строится ТОЛЬКО
 * по реальным опубликованным отзывам; пустой список => без рейтинга.
 */

export const ORG_TYPE = 'TouristTravelAgency';

export interface SeoOrganization {
  name: string;
  url: string;
  telegramUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
}

export function organizationLd(org: SeoOrganization): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ORG_TYPE,
    name: org.name,
    url: org.url,
  };
  if (org.logo) ld.logo = org.logo;
  const sameAs: string[] = [];
  if (org.telegramUrl) sameAs.push(org.telegramUrl);
  if (sameAs.length) ld.sameAs = sameAs;
  const contact: Record<string, unknown> = { '@type': 'ContactPoint', contactType: 'customer service', availableLanguage: ['ru'] };
  if (org.phone) contact.telephone = org.phone;
  if (org.email) contact.email = org.email;
  if (org.phone || org.email) ld.contactPoint = contact;
  return ld;
}

export interface BreadcrumbItem {
  name: string;
  url: string; // абсолютный или относительный путь
}

export function breadcrumbLd(siteUrl: string, items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url.startsWith('http') ? it.url : `${siteUrl}${it.url}`,
    })),
  };
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export function faqLd(items: FaqEntry[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export interface RatingReview {
  rating: number;
  authorName?: string | null;
  comment?: string | null;
  createdAt?: string | Date | null;
}

/**
 * AggregateRating — только по реальным отзывам (§13.5).
 * @returns null если отзывов нет — рейтинг в разметку НЕ добавляется.
 */
export function aggregateRatingLd(reviews: RatingReview[]): Record<string, unknown> | null {
  const ratings = reviews.map((r) => r.rating).filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  if (ratings.length === 0) return null;
  const best = Math.max(...ratings);
  const sum = ratings.reduce((a, b) => a + b, 0);
  return {
    '@type': 'AggregateRating',
    ratingValue: Math.round((sum / ratings.length) * 10) / 10,
    reviewCount: ratings.length,
    bestRating: best,
    worstRating: 1,
  };
}

export function reviewItemsLd(reviews: RatingReview[]): Record<string, unknown>[] {
  return reviews
    .filter((r) => Number.isFinite(r.rating))
    .slice(0, 10)
    .map((r) => {
      const ld: Record<string, unknown> = {
        '@type': 'Review',
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      };
      if (r.authorName) ld.author = { '@type': 'Person', name: r.authorName };
      if (r.comment) ld.reviewBody = r.comment;
      if (r.createdAt) ld.datePublished = new Date(r.createdAt).toISOString().slice(0, 10);
      return ld;
    });
}

/** Скрипт-тег JSON-LD (safe: JSON.stringify экранирует </script>) */
export function jsonLdScript(data: Record<string, unknown> | Record<string, unknown>[]): string {
  return JSON.stringify(data);
}
