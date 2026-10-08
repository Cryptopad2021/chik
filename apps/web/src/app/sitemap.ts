import type { MetadataRoute } from 'next';
import { apiGet, type TourSummary, type DestinationInfo } from '../lib/api';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** SEO sitemap.xml (ТЗ §30, §13) */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = ['', '/tours', '/destinations', '/reviews', '/about', '/contacts', '/faq', '/privacy', '/terms'].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: p === '' ? 1 : 0.7,
  }));

  const [tours, destinations] = await Promise.all([
    apiGet<TourSummary[]>('tours?limit=100', 60).catch(() => null),
    apiGet<DestinationInfo[]>('destinations', 300).catch(() => null),
  ]);

  const tourRoutes = (tours ?? []).map((t) => ({ url: `${BASE}/tours/${t.slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 }));
  const destRoutes = (destinations ?? []).map((d) => ({ url: `${BASE}/destinations/${d.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 }));

  return [...staticRoutes, ...tourRoutes, ...destRoutes];
}
