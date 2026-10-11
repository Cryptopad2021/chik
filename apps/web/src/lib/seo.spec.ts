import { describe, it, expect } from 'vitest';
import { organizationLd, breadcrumbLd, faqLd, aggregateRatingLd, reviewItemsLd, jsonLdScript } from './seo';

describe('organizationLd (ТЗ 13.3)', () => {
  it('включает только те поля, что реально заданы', () => {
    const ld = organizationLd({ name: 'ЧиркейТур', url: 'https://x.ru', telegramUrl: 'https://t.me/chirkey', phone: null, email: null, logo: null });
    expect(ld['@type']).toBe('TouristTravelAgency');
    expect(ld.sameAs).toEqual(['https://t.me/chirkey']);
    expect(ld.contactPoint).toBeUndefined();
    expect(ld.logo).toBeUndefined();
  });
});

describe('aggregateRatingLd (ТЗ 13.5 — без ложных данных)', () => {
  it('null при пустом списке отзывов', () => {
    expect(aggregateRatingLd([])).toBeNull();
  });
  it('считает средний рейтинг только по реальным отзывам', () => {
    const r = aggregateRatingLd([{ rating: 5 }, { rating: 4 }, { rating: 4 }]);
    expect(r).not.toBeNull();
    expect(r!.ratingValue).toBe(4.3);
    expect(r!.reviewCount).toBe(3);
    expect(r!.bestRating).toBe(5);
  });
  it('игнорирует некорректные значения рейтинга', () => {
    const r = aggregateRatingLd([{ rating: 0 }, { rating: 99 }, { rating: NaN }, { rating: 4 }]);
    expect(r!.reviewCount).toBe(1);
    expect(r!.ratingValue).toBe(4);
  });
});

describe('breadcrumbLd', () => {
  it('позиции 1..N и абсолютные item-URL', () => {
    const ld = breadcrumbLd('https://x.ru', [
      { name: 'Главная', url: '/' },
      { name: 'Туры', url: '/tours' },
    ]) as { itemListElement: { position: number; item: string }[] };
    expect(ld.itemListElement[0].position).toBe(1);
    expect(ld.itemListElement[1].item).toBe('https://x.ru/tours');
  });
});

describe('faqLd', () => {
  it('Question/acceptedAnswer из реальных элементов', () => {
    const ld = faqLd([{ question: 'Вопрос?', answer: 'Ответ!' }]) as { mainEntity: unknown[] };
    expect(ld.mainEntity).toHaveLength(1);
  });
});

describe('reviewItemsLd + jsonLdScript', () => {
  it('маппит автора/дату, ограничивает 10 шт.', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ rating: 5, authorName: `A${i}`, createdAt: '2026-01-01' }));
    const items = reviewItemsLd(many);
    expect(items).toHaveLength(10);
    expect((items[0] as { author: { name: string } }).author.name).toBe('A0');
  });
  it('jsonLdScript корректно сериализует', () => {
    expect(JSON.parse(jsonLdScript({ a: 1 }))).toEqual({ a: 1 });
  });
});
