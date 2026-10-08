import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ru } from '@/content/ru';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { apiGet, type SiteSettingsInfo, type DestinationInfo } from '../lib/api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

interface ListResponse<T> { items: T[]; total: number }

export async function generateMetadata(): Promise<Metadata> {
  const settings = await apiGet<SiteSettingsInfo>('settings/public', 300);
  const title = settings?.seoDefaultTitle ?? ru.home.heroTitle;
  const description = settings?.seoDefaultDescription ?? ru.home.heroSubtitle;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s — ${settings?.companyName ?? ru.common.brand}` },
    description,
    openGraph: { title, description, type: 'website', siteName: settings?.companyName ?? ru.common.brand, locale: 'ru_RU' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [settings, destinations] = await Promise.all([
    apiGet<SiteSettingsInfo>('settings/public', 300),
    apiGet<ListResponse<DestinationInfo>>('destinations', 300).then((r) => r?.items ?? []),
  ]);
  return (
    <html lang="ru">
      <body className="min-h-screen bg-stone-50 font-sans text-stone-900 antialiased">
        <Header telegramUrl={settings?.telegramUrl ?? null} />
        <main>{children}</main>
        <Footer settings={settings ?? null} destinations={destinations} />
      </body>
    </html>
  );
}
