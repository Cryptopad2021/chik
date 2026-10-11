import type { Metadata } from 'next';
import Link from 'next/link';
import { ru } from '@/content/ru';
import { apiGet, type FaqInfo } from '../../lib/api';
import { Breadcrumbs } from '../../components/Breadcrumbs';
import { faqLd, breadcrumbLd, jsonLdScript } from '../../lib/seo';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: ru.faq.title,
    description: 'Ответы на частые вопросы о турах ЧиркейТур: бронирование, оплата, что взять с собой.',
    alternates: { canonical: '/faq' },
  };
}

export default async function FaqPage() {
  const faq = await apiGet<FaqInfo[]>('faq', 120);
  const items = faq ?? [];

  // Группировка по категориям без хардкода контента (ТЗ §57)
  const groups = new Map<string, FaqInfo[]>();
  for (const f of items) {
    const key = f.category ?? 'Общие';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ name: 'Главная', href: '/' }, { name: ru.faq.title }]} />
      <h1 className="mt-2 font-serif text-3xl font-bold text-emerald-950 sm:text-4xl">{ru.faq.title}</h1>

      {items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-stone-600">
          {ru.faq.empty}
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {[...groups.entries()].map(([category, list]) => (
            <section key={category} aria-labelledby={`faq-${category}`}>
              <h2 id={`faq-${category}`} className="text-lg font-semibold text-emerald-900">{category}</h2>
              <dl className="mt-3 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
                {list.map((f) => (
                  <div key={f.id} className="p-5">
                    <dt className="font-medium text-stone-900">{f.question}</dt>
                    <dd className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-600">{f.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}

      {/* JSON-LD FAQPage + BreadcrumbList — только реальные данные со страницы (ТЗ §30, 13.3) */}
      {items.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(faqLd(items.map((f) => ({ question: f.question, answer: f.answer })))) }}
        />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(breadcrumbLd(SITE_URL, [{ name: 'Главная', url: '/' }, { name: ru.faq.title, url: '/faq' }])),
        }}
      />
    </div>
  );
}
