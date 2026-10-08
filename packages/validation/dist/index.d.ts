/**
 * @chirkey/validation — общие Zod-схемы (ТЗ §1: клиентская и серверная валидация из одного источника).
 * Используются и apps/web + apps/admin (client-side, React Hook Form), и apps/api (server-side).
 * Полные CRUD-схемы добавляются по фазам 5–7; здесь — базовые примитивы и схема бронирования (§14–16).
 */
import { z } from 'zod';
/** Телефон: принимаем форматы РФ/UA (+7..., 8..., 380...), нормализуем к цифрам. */
export declare const phoneSchema: z.ZodString;
export declare const emailSchema: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
export declare const telegramUsernameSchema: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
export declare const personNameSchema: z.ZodString;
/** Контакты клиента в форме брони (ТЗ §15 шаг 5). */
export declare const bookingContactSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    middleName: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    phone: z.ZodString;
    email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    telegramUsername: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, "strip", z.ZodTypeAny, {
    firstName: string;
    lastName: string;
    phone: string;
    middleName?: string | undefined;
    email?: string | undefined;
    telegramUsername?: string | undefined;
}, {
    firstName: string;
    lastName: string;
    phone: string;
    middleName?: string | undefined;
    email?: string | undefined;
    telegramUsername?: string | undefined;
}>;
/** Пассажир (ТЗ §16) — паспортные данные на первом этапе НЕ запрашиваются. */
export declare const passengerSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    middleName: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    birthDate: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    passengerType: z.ZodEnum<["ADULT", "CHILD_10_TO_14", "CHILD_UNDER_10"]>;
    phone: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    comment: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, "strip", z.ZodTypeAny, {
    firstName: string;
    lastName: string;
    passengerType: "ADULT" | "CHILD_10_TO_14" | "CHILD_UNDER_10";
    middleName?: string | undefined;
    phone?: string | undefined;
    birthDate?: string | undefined;
    comment?: string | undefined;
}, {
    firstName: string;
    lastName: string;
    passengerType: "ADULT" | "CHILD_10_TO_14" | "CHILD_UNDER_10";
    middleName?: string | undefined;
    phone?: string | undefined;
    birthDate?: string | undefined;
    comment?: string | undefined;
}>;
/** Создание заявки (публичный POST /api/bookings, ТЗ §14–15). */
export declare const createBookingSchema: z.ZodEffects<z.ZodObject<{
    departureId: z.ZodString;
    departureCityId: z.ZodString;
    adults: z.ZodNumber;
    children10to14: z.ZodNumber;
    childrenUnder10: z.ZodNumber;
    contact: z.ZodObject<{
        firstName: z.ZodString;
        lastName: z.ZodString;
        middleName: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        phone: z.ZodString;
        email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        telegramUsername: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    }, "strip", z.ZodTypeAny, {
        firstName: string;
        lastName: string;
        phone: string;
        middleName?: string | undefined;
        email?: string | undefined;
        telegramUsername?: string | undefined;
    }, {
        firstName: string;
        lastName: string;
        phone: string;
        middleName?: string | undefined;
        email?: string | undefined;
        telegramUsername?: string | undefined;
    }>;
    passengers: z.ZodOptional<z.ZodArray<z.ZodObject<{
        firstName: z.ZodString;
        lastName: z.ZodString;
        middleName: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        birthDate: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        passengerType: z.ZodEnum<["ADULT", "CHILD_10_TO_14", "CHILD_UNDER_10"]>;
        phone: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        comment: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    }, "strip", z.ZodTypeAny, {
        firstName: string;
        lastName: string;
        passengerType: "ADULT" | "CHILD_10_TO_14" | "CHILD_UNDER_10";
        middleName?: string | undefined;
        phone?: string | undefined;
        birthDate?: string | undefined;
        comment?: string | undefined;
    }, {
        firstName: string;
        lastName: string;
        passengerType: "ADULT" | "CHILD_10_TO_14" | "CHILD_UNDER_10";
        middleName?: string | undefined;
        phone?: string | undefined;
        birthDate?: string | undefined;
        comment?: string | undefined;
    }>, "many">>;
    comment: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    source: z.ZodDefault<z.ZodEnum<["WEBSITE", "TELEGRAM", "PHONE", "MANAGER", "OTHER"]>>;
    /** Идемпотентность (ТЗ §7.4): клиент генерирует токен, повторная отправка не создаёт дубль. */
    idempotencyKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    departureId: string;
    departureCityId: string;
    adults: number;
    children10to14: number;
    childrenUnder10: number;
    contact: {
        firstName: string;
        lastName: string;
        phone: string;
        middleName?: string | undefined;
        email?: string | undefined;
        telegramUsername?: string | undefined;
    };
    source: "MANAGER" | "WEBSITE" | "TELEGRAM" | "PHONE" | "OTHER";
    comment?: string | undefined;
    passengers?: {
        firstName: string;
        lastName: string;
        passengerType: "ADULT" | "CHILD_10_TO_14" | "CHILD_UNDER_10";
        middleName?: string | undefined;
        phone?: string | undefined;
        birthDate?: string | undefined;
        comment?: string | undefined;
    }[] | undefined;
    idempotencyKey?: string | undefined;
}, {
    departureId: string;
    departureCityId: string;
    adults: number;
    children10to14: number;
    childrenUnder10: number;
    contact: {
        firstName: string;
        lastName: string;
        phone: string;
        middleName?: string | undefined;
        email?: string | undefined;
        telegramUsername?: string | undefined;
    };
    comment?: string | undefined;
    passengers?: {
        firstName: string;
        lastName: string;
        passengerType: "ADULT" | "CHILD_10_TO_14" | "CHILD_UNDER_10";
        middleName?: string | undefined;
        phone?: string | undefined;
        birthDate?: string | undefined;
        comment?: string | undefined;
    }[] | undefined;
    source?: "MANAGER" | "WEBSITE" | "TELEGRAM" | "PHONE" | "OTHER" | undefined;
    idempotencyKey?: string | undefined;
}>, {
    departureId: string;
    departureCityId: string;
    adults: number;
    children10to14: number;
    childrenUnder10: number;
    contact: {
        firstName: string;
        lastName: string;
        phone: string;
        middleName?: string | undefined;
        email?: string | undefined;
        telegramUsername?: string | undefined;
    };
    source: "MANAGER" | "WEBSITE" | "TELEGRAM" | "PHONE" | "OTHER";
    comment?: string | undefined;
    passengers?: {
        firstName: string;
        lastName: string;
        passengerType: "ADULT" | "CHILD_10_TO_14" | "CHILD_UNDER_10";
        middleName?: string | undefined;
        phone?: string | undefined;
        birthDate?: string | undefined;
        comment?: string | undefined;
    }[] | undefined;
    idempotencyKey?: string | undefined;
}, {
    departureId: string;
    departureCityId: string;
    adults: number;
    children10to14: number;
    childrenUnder10: number;
    contact: {
        firstName: string;
        lastName: string;
        phone: string;
        middleName?: string | undefined;
        email?: string | undefined;
        telegramUsername?: string | undefined;
    };
    comment?: string | undefined;
    passengers?: {
        firstName: string;
        lastName: string;
        passengerType: "ADULT" | "CHILD_10_TO_14" | "CHILD_UNDER_10";
        middleName?: string | undefined;
        phone?: string | undefined;
        birthDate?: string | undefined;
        comment?: string | undefined;
    }[] | undefined;
    source?: "MANAGER" | "WEBSITE" | "TELEGRAM" | "PHONE" | "OTHER" | undefined;
    idempotencyKey?: string | undefined;
}>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type PassengerInput = z.infer<typeof passengerSchema>;
export type BookingContactInput = z.infer<typeof bookingContactSchema>;
