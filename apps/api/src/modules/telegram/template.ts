/**
 * Шаблонизатор Telegram-сообщений (ТЗ §34, Phase 10.4).
 * Синтаксис: {{path.to.value}} — значения подставляются из контекста по пути;
 * неизвестные ключи → пустая строка (сообщение не должно «сыпаться» на клиента).
 * Контекст строится только из данных backend — никаких цен «с воздуха» (§17).
 */

export type TemplateContext = Record<string, unknown>;

const PLACEHOLDER_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Разворачивает «a.b.c» в значение из вложенного объекта; отсутствие пути → undefined. */
function resolvePath(ctx: TemplateContext, path: string): unknown {
  let cur: unknown = ctx;
  for (const key of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => stringify(v)).join(', ');
  if (value instanceof Date) return formatDateRu(value);
  if (typeof value === 'object') return '';
  return String(value);
}

/** Дата в человекочитаемом RU-формате («15 ноября 2026») — единый формат для всех шаблонов. */
export function formatDateRu(d: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/**
 * Сумма с разделителями тысяч («45 000 ₽»).
 * Нормализуем NBSP (U+00A0) и узкий NBSP (U+202F), которые разные ICU-сборки
 * Node возвращают для ru-RU, к обычному пробелу — детерминированный вывод для шаблонов и тестов.
 */
export function formatMoneyRu(amount: number): string {
  const formatted = amount.toLocaleString('ru-RU').replace(/[\u00a0\u202f]/g, ' ');
  return `${formatted} ₽`;
}

/**
 * Рендер шаблона. Дефолтный шаблон (§34) используется, если template пустой.
 * Экранирование HTML делается в TelegramService.buildPayload (parse_mode=HTML).
 */
export const DEFAULT_TELEGRAM_TEMPLATE =
  '🏔 {{tour.title}}\n\n' +
  '📅 Дата выезда: {{departure.startDate}}\n' +
  '💰 Цена: {{departure.price}}\n' +
  '🪑 Свободных мест: {{departure.availableSeats}}\n' +
  '🚌 Города отправления: {{departure.cities}}\n\n' +
  '{{tour.shortDescription}}\n\n' +
  '👉 Забронировать: {{bookingUrl}}';

export function renderTemplate(template: string | null | undefined, ctx: TemplateContext): string {
  const tpl = (template && template.trim() ? template : DEFAULT_TELEGRAM_TEMPLATE).replaceAll('\r\n', '\n');
  // схлопываем строки, оставшиеся после пустых значений, чтобы не было «дыр»
  const out = tpl.replace(PLACEHOLDER_RE, (_m, path: string) => stringify(resolvePath(ctx, path)));
  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Список переменных, доступных редактору шаблона в админке (ТЗ 10.5). */
export const TEMPLATE_VARIABLES: Array<{ name: string; description: string }> = [
  { name: 'tour.title', description: 'Название тура' },
  { name: 'tour.slug', description: 'URL-адрес тура' },
  { name: 'tour.shortDescription', description: 'Краткое описание тура' },
  { name: 'tour.durationDays', description: 'Длительность (дней)' },
  { name: 'destination.name', description: 'Направление' },
  { name: 'departure.startDate', description: 'Дата выезда (дд месяц гггг)' },
  { name: 'departure.endDate', description: 'Дата возвращения' },
  { name: 'departure.price', description: 'Цена (₽)' },
  { name: 'departure.availableSeats', description: 'Свободные места' },
  { name: 'departure.totalSeats', description: 'Всего мест' },
  { name: 'departure.cities', description: 'Города отправления через запятую' },
  { name: 'bookingUrl', description: 'Ссылка на страницу бронирования' },
];
