import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** robots.txt (ТЗ §30) */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/booking/', '/api/'] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
