/**
 * @chirkey/validation — общие Zod-схемы (ТЗ §1: клиентская и серверная валидация из одного источника).
 * Используются и apps/web + apps/admin (client-side, React Hook Form), и apps/api (server-side).
 * Полные CRUD-схемы добавляются по фазам 5–7; здесь — базовые примитивы и схема бронирования (§14–16).
 */
import { z } from 'zod';
import { BOOKING_SOURCES, PASSENGER_TYPES } from '@chirkey/types';
/** Телефон: принимаем форматы РФ/UA (+7..., 8..., 380...), нормализуем к цифрам. */
export const phoneSchema = z
    .string()
    .trim()
    .min(10, 'Укажите телефон')
    .max(20, 'Некорректный телефон')
    .regex(/^\+?[\d\s\-()]+$/, 'Некорректный формат телефона');
export const emailSchema = z.string().trim().email('Некорректный email').optional().or(z.literal(''));
export const telegramUsernameSchema = z
    .string()
    .trim()
    .regex(/^@?[A-Za-z][A-Za-z0-9_]{4,32}$/, 'Некорректный Telegram username')
    .optional()
    .or(z.literal(''));
export const personNameSchema = z.string().trim().min(2, 'Минимум 2 символа').max(100);
/** Контакты клиента в форме брони (ТЗ §15 шаг 5). */
export const bookingContactSchema = z.object({
    firstName: personNameSchema,
    lastName: personNameSchema,
    middleName: personNameSchema.optional().or(z.literal('')),
    phone: phoneSchema,
    email: emailSchema,
    telegramUsername: telegramUsernameSchema,
});
/** Пассажир (ТЗ §16) — паспортные данные на первом этапе НЕ запрашиваются. */
export const passengerSchema = z.object({
    firstName: personNameSchema,
    lastName: personNameSchema,
    middleName: personNameSchema.optional().or(z.literal('')),
    birthDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД')
        .optional()
        .or(z.literal('')),
    passengerType: z.enum(PASSENGER_TYPES),
    phone: phoneSchema.optional().or(z.literal('')),
    comment: z.string().trim().max(500).optional().or(z.literal('')),
});
/** Создание заявки (публичный POST /api/bookings, ТЗ §14–15). */
export const createBookingSchema = z.object({
    departureId: z.string().uuid('Выберите дату выезда'),
    departureCityId: z.string().uuid('Выберите город отправления'),
    adults: z.coerce.number().int().min(0).max(50),
    children10to14: z.coerce.number().int().min(0).max(50),
    childrenUnder10: z.coerce.number().int().min(0).max(50),
    contact: bookingContactSchema,
    passengers: z.array(passengerSchema).optional(),
    comment: z.string().trim().max(1000).optional().or(z.literal('')),
    source: z.enum(BOOKING_SOURCES).default('WEBSITE'),
    /** Идемпотентность (ТЗ §7.4): клиент генерирует токен, повторная отправка не создаёт дубль. */
    idempotencyKey: z.string().min(8).max(64).optional(),
}).refine((d) => d.adults + d.children10to14 + d.childrenUnder10 > 0, {
    message: 'Укажите хотя бы одного туриста',
    path: ['adults'],
});
//# sourceMappingURL=index.js.map