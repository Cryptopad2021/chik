/** Разрешённые типы событий аналитики (ТЗ §71). */
export const ANALYTICS_EVENT_TYPES = [
  'view_tour',
  'select_departure',
  'start_booking',
  'booking_created',
  'booking_confirmed',
  'telegram_click',
  'phone_click',
  'review_submitted',
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

/** Поля, которые никогда не должны попадать в аналитику (ТЗ §72 — без ПДн). */
const PII_KEY_PATTERN = /(phone|email|passport|name|firstName|lastName|middleName|surname|telegramUsername|address|birthday|birthDate)/i;

/** Возвращает список запрещённых ключей, найденных в metadata (рекурсивно). */
export function findPiiKeys(value: unknown, depth = 0): string[] {
  if (depth > 4 || value == null) return [];
  if (Array.isArray(value)) return value.flatMap((v) => findPiiKeys(v, depth + 1));
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj).flatMap((k) =>
      PII_KEY_PATTERN.test(k) ? [k] : findPiiKeys(obj[k], depth + 1),
    );
  }
  return [];
}
