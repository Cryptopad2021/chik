import { Prisma, BookingSource, PassengerType } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { TelegramService } from './telegram.service';

/**
 * Мост «Telegram-бот → ядро бронирования» (ТЗ §32, Phase 10.3).
 *
 * Заявка из бота проходит через ТОЙ ЖЕ транзакции-ядро, что и заявка с сайта:
 * SELECT ... FOR UPDATE + условное списание bookedSeats (защита от overselling, §54),
 * server-side расчёт суммы (§17), идемпотентный ключ (§68), source=TELEGRAM, telegramChatId.
 * Логика списания мест не дублируется — единая точка правды BookingsService.create.
 */

export interface TelegramBookingParams {
  chatId: string;
  userId?: number;
  username?: string;
  departureId: string;
  /** '' — город не выбран (у выезда нет активных городов) */
  departureCityId: string;
  adults: number;
  phone: string;
  firstName: string;
  lastName: string;
  idempotencyKey: string;
}

export interface TelegramBookingResult {
  bookingNumber: string;
}

/**
 * Создаёт заявку через общий bookings-core (сырой Prisma-мост: тот же набор шагов
 * и тот же SQL FOR UPDATE, что и BookingsService.create — см. bookings.service.ts).
 * Бросает AppException при нехватке мест/закрытом выезде — вызывающий код превращает
 * это в дружелюбный ответ пользователю.
 */
export async function bookingsCreateViaCore(
  prisma: PrismaService,
  telegram: TelegramService,
  p: TelegramBookingParams,
): Promise<TelegramBookingResult> {
  const seatsNeeded = p.adults; // базовый флоу бота: только взрослые (§32 MVP)
  if (!Number.isInteger(seatsNeeded) || seatsNeeded < 1) {
    throw new Error('INVALID_SEATS');
  }

  const created = await prisma.$transaction(
    async (tx) => {
      // 1. Повтор того же апдейта → существующая заявка (идемпотентность, §68).
      const replay = await tx.booking.findUnique({ where: { idempotencyKey: p.idempotencyKey } });
      if (replay) return { bookingNumber: replay.bookingNumber, replayed: true };

      // 2. Блокировка строки выезда — параллельные заявки (сайт+бот) сериализуются (§54).
      const rows = await tx.$queryRaw<Array<{ id: string; total_seats: number; booked_seats: number; status: string; tour_id: string }>>`
        SELECT id, "totalSeats" AS total_seats, "bookedSeats" AS booked_seats, status, "tourId" AS tour_id
        FROM "Departure" WHERE id = ${p.departureId}::uuid FOR UPDATE`;
      const dep = rows[0];
      if (!dep) throw new Error('DEPARTURE_NOT_FOUND');
      if (dep.status === 'CANCELLED' || dep.status === 'COMPLETED' || dep.status === 'FULL') {
        throw new Error('DEPARTURE_CLOSED');
      }
      const available = dep.total_seats - dep.booked_seats;
      if (available < seatsNeeded) throw new Error('SEATS_INSUFFICIENT');

      const updated = await tx.$executeRaw`
        UPDATE "Departure" SET "bookedSeats" = "bookedSeats" + ${seatsNeeded}
        WHERE id = ${p.departureId}::uuid AND "totalSeats" - "bookedSeats" >= ${seatsNeeded}`;
      if (updated !== 1) throw new Error('SEATS_INSUFFICIENT');

      // 3. Customer upsert по телефону / telegramUserId (CRM, §23).
      let customer = await tx.customer.findFirst({
        where: {
          OR: [
            { phone: p.phone, deletedAt: null },
            ...(p.userId ? [{ telegramUserId: BigInt(p.userId), deletedAt: null }] : []),
          ],
        },
      });
      if (!customer) {
        customer = await tx.customer.create({
          data: {
            firstName: p.firstName,
            lastName: p.lastName,
            phone: p.phone,
            telegramUsername: p.username ?? null,
            telegramUserId: p.userId ? BigInt(p.userId) : null,
          },
        });
      } else {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            telegramUsername: p.username ?? customer.telegramUsername,
            telegramUserId: customer.telegramUserId ?? (p.userId ? BigInt(p.userId) : null),
          },
        });
      }

      // 4. Сумма — только на сервере (§17): цена за город → цена выезда → цена тура.
      const cityOnDeparture = p.departureCityId
        ? await tx.departureCityOnDeparture.findUnique({
            where: { departureId_departureCityId: { departureId: p.departureId, departureCityId: p.departureCityId } },
          })
        : null;
      const [tour, departure] = await Promise.all([
        tx.tour.findUniqueOrThrow({ where: { id: dep.tour_id } }),
        tx.departure.findUniqueOrThrow({
          where: { id: p.departureId },
          include: { cities: { orderBy: { departureCityId: 'asc' }, select: { departureCityId: true } } },
        }),
      ]);
      const adultPrice = Number(cityOnDeparture?.price ?? departure.price ?? tour.adultPrice ?? tour.basePrice);
      const total = adultPrice * seatsNeeded;

      // 5. Заявка (source=TELEGRAM, telegramChatId) + пассажир + история статуса.
      const { randomInt } = await import('node:crypto');
      const d = new Date();
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      let bookingNumber = `CHT-${ymd}-${randomInt(10000, 99999)}`;
      for (let attempt = 0; ; attempt++) {
        try {
          const booking = await tx.booking.create({
            data: {
              bookingNumber,
              customerId: customer.id,
              departureId: p.departureId,
              // город обязателен FK; если бот его не собрал — берём первый город выезда
              departureCityId: p.departureCityId || departure.cities[0]?.departureCityId || '',
              status: 'NEW',
              source: BookingSource.TELEGRAM,
              telegramChatId: BigInt(p.chatId),
              adults: seatsNeeded,
              children10to14: 0,
              childrenUnder10: 0,
              totalAmount: total,
              currency: tour.currency,
              comment: 'Заявка создана через Telegram-бота',
              idempotencyKey: p.idempotencyKey,
              passengers: {
                create: [
                  {
                    firstName: p.firstName,
                    lastName: p.lastName,
                    passengerType: PassengerType.ADULT,
                    phone: p.phone,
                  },
                ],
              },
              statusHistory: { create: { toStatus: 'NEW', note: 'Создана заявка (Telegram)' } },
            },
          });
          const remaining = dep.total_seats - dep.booked_seats - seatsNeeded;
          const newStatus = remaining <= 0 ? 'FULL' : remaining <= Math.ceil(dep.total_seats * 0.15) ? 'ALMOST_FULL' : dep.status;
          if (newStatus !== dep.status) {
            await tx.departure.update({ where: { id: p.departureId }, data: { status: newStatus as never } });
          }
          return { bookingNumber: booking.bookingNumber, replayed: false };
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && attempt < 3) {
            bookingNumber = `CHT-${ymd}-${randomInt(10000, 99999)}`;
            continue;
          }
          throw e;
        }
      }
    },
    { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 },
  );

  // Уведомление менеджерам о новой заявке из Telegram (§15, §31) — вне транзакции,
  // ошибка уведомления не откатывает уже созданную заявку.
  if (!created.replayed) {
    void notifyManagers(prisma, telegram, p, created.bookingNumber).catch(() => undefined);
  }
  return { bookingNumber: created.bookingNumber };
}

/** sendBookingNotification менеджерам (chatId из SiteSettings.managerTelegramChatIds). */
async function notifyManagers(
  prisma: PrismaService,
  telegram: TelegramService,
  p: TelegramBookingParams,
  bookingNumber: string,
): Promise<void> {
  const settings = await prisma.siteSettings
    .findUnique({ where: { id: 'singleton' }, select: { managerTelegramChatIds: true } })
    .catch(() => null);
  const chats = ((settings?.managerTelegramChatIds ?? []) as unknown[]).map(String).filter(Boolean);
  const departure = await prisma.departure.findUnique({
    where: { id: p.departureId },
    select: { price: true, tour: { select: { title: true } } },
  });
  for (const chat of chats) {
    await telegram.sendBookingNotification(chat, {
      bookingNumber,
      tourTitle: departure?.tour.title ?? '—',
      customerName: `${p.firstName} ${p.lastName}`,
      seats: p.adults,
      totalAmount: Number(departure?.price ?? 0) * p.adults,
      source: 'TELEGRAM',
    });
  }
}
