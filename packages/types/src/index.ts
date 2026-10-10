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
] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ---------- Статусы тура (ТЗ §8) ----------
export const TOUR_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type TourStatus = (typeof TOUR_STATUSES)[number];

// ---------- Статусы выезда (ТЗ §12) ----------
export const DEPARTURE_STATUSES = [
  'OPEN',
  'ALMOST_FULL',
  'FULL',
  'CANCELLED',
  'COMPLETED',
] as const;
export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

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
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// ---------- Источники брони (ТЗ §14) ----------
export const BOOKING_SOURCES = ['WEBSITE', 'TELEGRAM', 'TG_BOT', 'PHONE', 'MANAGER', 'OTHER'] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

// ---------- Тип пассажира (ТЗ §16, ценообразование §17) ----------
export const PASSENGER_TYPES = ['ADULT', 'CHILD_10_TO_14', 'CHILD_UNDER_10'] as const;
export type PassengerType = (typeof PASSENGER_TYPES)[number];

// ---------- Статусы оплаты (ТЗ §37) ----------
export const PAYMENT_STATUSES = ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ---------- Статусы отзыва (ТЗ §24) ----------
export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// ---------- Статусы Telegram-поста (ТЗ §33) ----------
export const TELEGRAM_POST_STATUSES = ['DRAFT', 'SENT', 'FAILED'] as const;
export type TelegramPostStatus = (typeof TELEGRAM_POST_STATUSES)[number];

// ---------- Каналы уведомлений (ТЗ §35) ----------
export const NOTIFICATION_CHANNELS = ['EMAIL', 'TELEGRAM', 'SYSTEM'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// ---------- События уведомлений (ТЗ §35) ----------
export const NOTIFICATION_EVENTS = [
  'booking.created',
  'booking.confirmed',
  'booking.cancelled',
  'booking.paid',
  'departure.updated',
  'departure.tomorrow',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

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
  'DESTINATION_NOT_FOUND',
  'CITY_NOT_FOUND',
  'FILE_NOT_FOUND',
  'INVALID_IMAGE',
  'FILE_TOO_LARGE',
  'STORAGE_UNAVAILABLE',
  'DEPARTURE_NOT_FOUND',
  'BOOKING_NOT_FOUND',
  'CUSTOMER_NOT_FOUND',
  'SEATS_INSUFFICIENT',
  'DEPARTURE_CLOSED',
  'DUPLICATE_SUBMISSION',
  'TELEGRAM_PUBLISH_FAILED',
  'DATABASE_UNAVAILABLE',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Единый формат ответа об ошибке (ТЗ §45). */
export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/** Успешный ответ с данными. */
export interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

/** Пагинированный список. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Слайд hero-карусели на главной (управляется из админки через направление). */
export interface HeroSlide {
  destinationId: string;
  slug: string;            // slug направления — клик ведёт на /destinations/[slug]
  tourSlug: string | null; // главный тур слайда — клик ведёт на /tours/[tourSlug]
  title: string;           // heroSlideTitle ?? name
  text: string;            // heroSlideText ?? shortDescription первого тура
  imageUrl: string | null; // heroSlideImageUrl ?? coverImageUrl ?? обложка тура
}
