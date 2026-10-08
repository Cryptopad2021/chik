/** Форматирование цен/дат для RU-локализации (ТЗ §4, §17 — цены приходят с backend, здесь только отображение) */

export function formatPrice(amount: number, currency: string = 'RUB'): string {
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ₽`;
  }
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** "3 дня / 2 ночи" из чисел; null если данных нет (empty state, ТЗ §67) */
export function formatDuration(days?: number | null, nights?: number | null): string | null {
  if (!days && !nights) return null;
  const dayWord = pluralize(days ?? 0, ['день', 'дня', 'дней']);
  const nightPart = nights ? ` / ${nights} ${pluralize(nights, ['ночь', 'ночи', 'ночей'])}` : '';
  return `${days ?? 0} ${dayWord}${nightPart}`;
}

/** Русская плюрализация: 1 день, 2 дня, 5 дней */
export function pluralize(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (d > 1 && d < 5) return forms[1];
  if (d === 1) return forms[0];
  return forms[2];
}

export function seatsLabel(available: number): string {
  return `${available} ${pluralize(available, ['место', 'места', 'мест'])}`;
}
