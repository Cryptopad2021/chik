import type { Metadata } from 'next';
import { ru } from '@/content/ru';
import { apiGet, type FaqInfo } from '../../lib/api';

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
      <h1 className="font-serif text-3xl font-bold text-emerald-950 sm:text-4xl">{ru.faq.title}</h1>

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

      {/* JSON-LD FAQPage — только реальные данные со страницы (ТЗ §30: не генерировать ложные SEO-данные) */}
      {items.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: items.map((f) => ({
                '@type': 'Question',
                name: f.question,
                acceptedAnswer: { '@type': 'Answer', text: f.answer },
              })),
            }),
          }}
        />
      ) : null}
    </div>
  );
}
