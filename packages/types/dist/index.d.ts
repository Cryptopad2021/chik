/**
 * @chirkey/types — доменные типы и константы monorepo.
 *
 * ВАЖНО (ТЗ §2.4, Phase 2): перечисления здесь зеркалят Prisma enum-ы.
 * После генерации Prisma-клиента типы будут переэкспортированы из него,
 * чтобы исключить расхождение. Сейчас — источник истины для API/UI.
 */
export declare const USER_ROLES: readonly ["SUPER_ADMIN", "ADMIN", "MANAGER", "CONTENT_MANAGER", "VIEWER"];
export type UserRole = (typeof USER_ROLES)[number];
export declare const TOUR_STATUSES: readonly ["DRAFT", "PUBLISHED", "ARCHIVED"];
export type TourStatus = (typeof TOUR_STATUSES)[number];
export declare const DEPARTURE_STATUSES: readonly ["OPEN", "ALMOST_FULL", "FULL", "CANCELLED", "COMPLETED"];
export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];
export declare const BOOKING_STATUSES: readonly ["NEW", "CONTACTED", "PENDING_CONFIRMATION", "CONFIRMED", "PAYMENT_PENDING", "PAID", "CANCELLED", "COMPLETED", "REFUNDED"];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export declare const BOOKING_SOURCES: readonly ["WEBSITE", "TELEGRAM", "PHONE", "MANAGER", "OTHER"];
export type BookingSource = (typeof BOOKING_SOURCES)[number];
export declare const PASSENGER_TYPES: readonly ["ADULT", "CHILD_10_TO_14", "CHILD_UNDER_10"];
export type PassengerType = (typeof PASSENGER_TYPES)[number];
export declare const PAYMENT_STATUSES: readonly ["PENDING", "AUTHORIZED", "PAID", "FAILED", "REFUNDED"];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export declare const REVIEW_STATUSES: readonly ["PENDING", "APPROVED", "REJECTED"];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export declare const TELEGRAM_POST_STATUSES: readonly ["DRAFT", "SENT", "FAILED"];
export type TelegramPostStatus = (typeof TELEGRAM_POST_STATUSES)[number];
export declare const NOTIFICATION_CHANNELS: readonly ["EMAIL", "TELEGRAM", "SYSTEM"];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export declare const NOTIFICATION_EVENTS: readonly ["booking.created", "booking.confirmed", "booking.cancelled", "booking.paid", "departure.updated", "departure.tomorrow"];
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];
export declare const ERROR_CODES: readonly ["VALIDATION_FAILED", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "RATE_LIMITED", "INTERNAL_ERROR", "TOUR_NOT_FOUND", "DEPARTURE_NOT_FOUND", "BOOKING_NOT_FOUND", "CUSTOMER_NOT_FOUND", "SEATS_INSUFFICIENT", "DEPARTURE_CLOSED", "DUPLICATE_SUBMISSION", "TELEGRAM_PUBLISH_FAILED", "DATABASE_UNAVAILABLE"];
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
