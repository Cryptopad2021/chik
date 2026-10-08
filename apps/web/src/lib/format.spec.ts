import { describe, it, expect } from 'vitest';
import { formatPrice, formatDuration, pluralize, formatDate, seatsLabel } from './format';

describe('formatPrice', () => {
  it('форматирует рубли без дробей', () => {
    // Intl использует неразрывные пробелы (U+00A0) — нормализуем для сравнения
    expect(formatPrice(15000).replace(/\u00A0/g, ' ')).toBe('15 000 ₽');
  });
});

describe('pluralize', () => {
  it('склоняет «день»', () => {
    expect(pluralize(1, ['день', 'дня', 'дней'])).toBe('день');
    expect(pluralize(2, ['день', 'дня', 'дней'])).toBe('дня');
    expect(pluralize(5, ['день', 'дня', 'дней'])).toBe('дней');
    expect(pluralize(11, ['день', 'дня', 'дней'])).toBe('дней');
    expect(pluralize(21, ['день', 'дня', 'дней'])).toBe('день');
  });
});

describe('formatDuration', () => {
  it('даёт "3 дня / 2 ночи"', () => {
    expect(formatDuration(3, 2)).toBe('3 дня / 2 ночи');
  });
  it('null когда данных нет', () => {
    expect(formatDuration(null, undefined)).toBeNull();
  });
});

describe('formatDate', () => {
  it('парсит ISO в RU-формат', () => {
    expect(formatDate('2026-05-01')).toContain('2026');
  });
  it('пустая строка при мусоре', () => {
    expect(formatDate('not-a-date')).toBe('');
  });
});

describe('seatsLabel', () => {
  it('1 место / 2 места / 5 мест', () => {
    expect(seatsLabel(1)).toBe('1 место');
    expect(seatsLabel(2)).toBe('2 места');
    expect(seatsLabel(5)).toBe('5 мест');
  });
});
