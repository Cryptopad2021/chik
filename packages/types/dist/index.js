/**
 * @chirkey/types — доменные типы и константы monorepo.
 *
 * ВАЖНО (ТЗ §2.4, Phase 2): перечисления здесь зеркалят Prisma enum-ы.
 * После генерации Prisma-клиента типы будут переэкспортированы из него,
 * чтобы исключить расхождение. Сейчас — источник истины для API/UI.
 */
// ---------- Роли сотрудников (ТЗ §7) ----------
export const USER_ROLES = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'CONTENT_MANAGER',
    'VIEWER',
];
// ---------- Статусы тура (ТЗ §8) ----------
export const TOUR_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
// ---------- Статусы выезда (ТЗ §12) ----------
export const DEPARTURE_STATUSES = [
    'OPEN',
    'ALMOST_FULL',
    'FULL',
    'CANCELLED',
    'COMPLETED',
];
// ---------- Статусы брони (ТЗ §14) ----------
export const BOOKING_STATUSES = [
    'NEW',
    'CONTACTED',
    'PENDING_CONFIRMATION',
    'CONFIRMED',
    'PAYMENT_PENDING',
    'PAID',
    'CANCELLED',
    'COMPLETED',
    'REFUNDED',
];
// ---------- Источники брони (ТЗ §14) ----------
export const BOOKING_SOURCES = ['WEBSITE', 'TELEGRAM', 'PHONE', 'MANAGER', 'OTHER'];
// ---------- Тип пассажира (ТЗ §16, ценообразование §17) ----------
export const PASSENGER_TYPES = ['ADULT', 'CHILD_10_TO_14', 'CHILD_UNDER_10'];
// ---------- Статусы оплаты (ТЗ §37) ----------
export const PAYMENT_STATUSES = ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED'];
// ---------- Статусы отзыва (ТЗ §24) ----------
export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
// ---------- Статусы Telegram-поста (ТЗ §33) ----------
export const TELEGRAM_POST_STATUSES = ['DRAFT', 'SENT', 'FAILED'];
// ---------- Каналы уведомлений (ТЗ §35) ----------
export const NOTIFICATION_CHANNELS = ['EMAIL', 'TELEGRAM', 'SYSTEM'];
// ---------- События уведомлений (ТЗ §35) ----------
export const NOTIFICATION_EVENTS = [
    'booking.created',
    'booking.confirmed',
    'booking.cancelled',
    'booking.paid',
    'departure.updated',
    'departure.tomorrow',
];
// ---------- Коды ошибок API (ТЗ §45) ----------
export const ERROR_CODES = [
    'VALIDATION_FAILED',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
    // доменные:
    'TOUR_NOT_FOUND',
    'DEPARTURE_NOT_FOUND',
    'BOOKING_NOT_FOUND',
    'CUSTOMER_NOT_FOUND',
    'SEATS_INSUFFICIENT',
    'DEPARTURE_CLOSED',
    'DUPLICATE_SUBMISSION',
    'TELEGRAM_PUBLISH_FAILED',
    'DATABASE_UNAVAILABLE',
];
//# sourceMappingURL=index.js.map