import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  DEFAULT_TELEGRAM_TEMPLATE,
  formatDateRu,
  formatMoneyRu,
  TEMPLATE_VARIABLES,
} from './template';

/** Unit-тесты шаблонизатора Telegram-постов (ТЗ §34, Phase 10.7). */

const ctx = {
  tour: { title: 'Тур в Дагестан', slug: 'tur-v-dagestan', shortDescription: 'Горы и море', durationDays: 3 },
  destination: { name: 'Дагестан' },
  departure: {
    startDate: new Date('2026-11-15T08:00:00Z'),
    endDate: new Date('2026-11-18T08:00:00Z'),
    price: '45 000 ₽',
    availableSeats: 7,
    totalSeats: 18,
    cities: ['Ростов-на-Дону', 'Таганрог'],
  },
  bookingUrl: 'https://chirkey.tour/tours/tur-v-dagestan',
};

describe('renderTemplate (§34)', () => {
  it('подставляет все переменные дефолтного шаблона', () => {
    const out = renderTemplate(null, ctx);
    expect(out).toContain('Тур в Дагестан');
    expect(out).toMatch(/15 ноября 2026/); // Intl ru-RU: «15 ноября 2026» или «15 ноября 2026 г.»
    expect(out).toContain('45 000 ₽');
    expect(out).toContain('Свободных мест: 7');
    expect(out).toContain('Ростов-на-Дону, Таганрог'); // массив → через запятую
    expect(out).toContain('https://chirkey.tour/tours/tur-v-dagestan');
  });

  it('рендерит пользовательский шаблон с {{path}}', () => {
    const out = renderTemplate('Тур: {{tour.title}} | Мест: {{departure.availableSeats}}', ctx);
    expect(out).toBe('Тур: Тур в Дагестан | Мест: 7');
  });

  it('неизвестный ключ → пустая строка, сообщение не «сыпается»', () => {
    const out = renderTemplate('A{{no.such.key}}B', ctx);
    expect(out).toBe('AB');
  });

  it('пустые значения не оставляют «дыр» из трёх переносов', () => {
    const out = renderTemplate('Л1\n{{empty.field}}\n\nЛ2\n\n\nЛ3', ctx);
    expect(out).toBe('Л1\n\nЛ2\n\nЛ3');
  });

  it('CRLF нормализуется в LF', () => {
    const out = renderTemplate('а\r\nб', ctx);
    expect(out).toBe('а\nб');
  });

  it('дефолтный шаблон содержит все обязательные переменные ТЗ §34', () => {
    for (const v of ['tour.title', 'departure.startDate', 'departure.price', 'departure.availableSeats', 'departure.cities', 'bookingUrl']) {
      expect(DEFAULT_TELEGRAM_TEMPLATE).toContain(`{{${v}}}`);
      expect(TEMPLATE_VARIABLES.some((x) => x.name === v)).toBe(true);
    }
  });
});

describe('форматтеры', () => {
  it('formatDateRu — человекочитаемый RU-формат', () => {
    expect(formatDateRu(new Date('2026-11-15T12:00:00Z'))).toMatch(/15 ноября 2026/);
  });
  it('formatMoneyRu — разделители тысяч + ₽', () => {
    expect(formatMoneyRu(45000)).toBe('45 000 ₽');
  });
});
