import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, PassengerType, BookingStatus, DepartureStatus } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/app-exception';
import { CreateBookingDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Бизнес-логика бронирования (ТЗ §14–17, 54).
 * Защита от overselling: SELECT ... FOR UPDATE + условный UPDATE bookedSeats в одной транзакции.
 */
@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private get db() {
    if (!this.prisma.isHealthy()) throw AppException.databaseUnavailable();
    return this.prisma;
  }

  private generateBookingNumber(): string {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `CHT-${ymd}-${randomInt(10000, 99999)}`;
  }

  async create(dto: CreateBookingDto) {
    // Идемпотентность против двойной отправки формы (ТЗ §68): повторный ключ → существующая заявка.
    if (dto.idempotencyKey) {
      const existing = await this.db.booking.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (existing) return { booking: existing, replayed: true };
    }

    const seatsNeeded = dto.adults + dto.children10to14 + dto.childrenUnder10;
    if (seatsNeeded <= 0) throw AppException.validation('Укажите хотя бы одного участника');
    const typeCount = {
      ADULT: dto.passengers.filter((p) => p.passengerType === 'ADULT').length,
      CHILD_10_TO_14: dto.passengers.filter((p) => p.passengerType === 'CHILD_10_TO_14').length,
      CHILD_UNDER_10: dto.passengers.filter((p) => p.passengerType === 'CHILD_UNDER_10').length,
    };
    if (typeCount.ADULT !== dto.adults || typeCount.CHILD_10_TO_14 !== dto.children10to14 || typeCount.CHILD_UNDER_10 !== dto.childrenUnder10) {
      throw AppException.validation('Список пассажиров не соответствует количеству взрослых/детей');
    }

    return this.db.$transaction(
      async (tx) => {
        // 1. Блокируем строку выезда (FOR UPDATE) — параллельная транзакция ждёт этой блокировки.
        const rows = await tx.$queryRaw<Array<{ id: string; total_seats: number; booked_seats: number; status: string; tour_id: string }>>`
          SELECT id, "totalSeats" AS total_seats, "bookedSeats" AS booked_seats, status, "tourId" AS tour_id
          FROM "Departure" WHERE id = ${dto.departureId}::uuid FOR UPDATE`;
        const dep = rows[0];
        if (!dep) throw new AppException('DEPARTURE_NOT_FOUND', 'Выезд не найден', 404);
        if (dep.status === 'CANCELLED' || dep.status === 'COMPLETED' || dep.status === 'FULL') {
          throw AppException.departureClosed();
        }
        const available = dep.total_seats - dep.booked_seats;
        if (available < seatsNeeded) throw AppException.seatsInsufficient(available, seatsNeeded);

        // 2. Атомарное списание мест с повторной проверкой доступности в условии UPDATE.
        const updated = await tx.$executeRaw`
          UPDATE "Departure" SET "bookedSeats" = "bookedSeats" + ${seatsNeeded}
          WHERE id = ${dto.departureId}::uuid AND "totalSeats" - "bookedSeats" >= ${seatsNeeded}`;
        if (updated !== 1) throw AppException.seatsInsufficient(available, seatsNeeded);

        // 3. Customer upsert по телефону (CRM, ТЗ §23).
        let customer = await tx.customer.findFirst({ where: { phone: dto.customer.phone, deletedAt: null } });
        if (!customer) {
          customer = await tx.customer.create({
            data: {
              firstName: dto.customer.firstName,
              lastName: dto.customer.lastName,
              middleName: dto.customer.middleName ?? null,
              phone: dto.customer.phone,
              email: dto.customer.email ?? null,
              telegramUsername: dto.customer.telegramUsername ?? null,
            },
          });
        }

        // 4. Пересчёт суммы на сервере (ТЗ §17 — цены только с backend).
        const [tour, departure, cityOnDeparture] = await Promise.all([
          tx.tour.findUniqueOrThrow({ where: { id: dep.tour_id } }),
          tx.departure.findUniqueOrThrow({ where: { id: dto.departureId } }),
          tx.departureCityOnDeparture.findUnique({ where: { departureId_departureCityId: { departureId: dto.departureId, departureCityId: dto.departureCityId } } }),
        ]);
        const adultPrice = Number(cityOnDeparture?.price ?? departure.price ?? tour.adultPrice ?? tour.basePrice);
        const child10 = Number(tour.child10to14Price ?? Math.round(adultPrice * 0.8));
        const childU10 = Number(tour.childUnder10Price ?? Math.round(adultPrice * 0.5));
        const total = adultPrice * dto.adults + child10 * dto.children10to14 + childU10 * dto.childrenUnder10;

        // 5. Заявка + пассажиры + история статуса.
        let bookingNumber = this.generateBookingNumber();
        for (let attempt = 0; ; attempt++) {
          try {
            const booking = await tx.booking.create({
              data: {
                bookingNumber,
                customerId: customer.id,
                departureId: dto.departureId,
                departureCityId: dto.departureCityId,
                status: 'NEW',
                source: dto.source ?? 'WEBSITE',
                adults: dto.adults,
                children10to14: dto.children10to14,
                childrenUnder10: dto.childrenUnder10,
                totalAmount: total,
                currency: tour.currency,
                comment: dto.comment ?? null,
                idempotencyKey: dto.idempotencyKey ?? null,
                passengers: {
                  create: dto.passengers.map((p) => ({
                    firstName: p.firstName,
                    lastName: p.lastName,
                    middleName: p.middleName ?? null,
                    birthDate: p.birthDate ? new Date(p.birthDate) : null,
                    passengerType: p.passengerType as PassengerType,
                    phone: p.phone ?? null,
                    comment: p.comment ?? null,
                  })),
                },
                statusHistory: { create: { toStatus: 'NEW', note: 'Создана заявка' } },
              },
              include: { passengers: true },
            });
            // Обновляем статус выезда (ALMOST_FULL/FULL) в той же транзакции.
            const remaining = dep.total_seats - dep.booked_seats - seatsNeeded;
            const newStatus = remaining <= 0 ? 'FULL' : remaining <= Math.ceil(dep.total_seats * 0.15) ? 'ALMOST_FULL' : dep.status;
            if (newStatus !== dep.status) {
              await tx.departure.update({ where: { id: dto.departureId }, data: { status: newStatus as DepartureStatus } });
            }
            return { booking, replayed: false };
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && attempt < 3) {
              bookingNumber = this.generateBookingNumber();
              continue;
            }
            throw e;
          }
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 10000 },
    ).then(async (res) => {
      // Уведомление менеджеров о новой заявке (ТЗ §15, §35). Внешние отправки — за feature-флагом (§55),
      // поэтому ошибка уведомления не должна ломать уже созданное бронирование.
      if (!res.replayed) {
        void this.notifications
          .onBookingCreated({
            bookingId: res.booking.id,
            bookingNumber: res.booking.bookingNumber,
            tourTitle: '—',
            customerName: `${dto.customer.firstName} ${dto.customer.lastName}`.trim(),
            seats: seatsNeeded,
            totalAmount: Number(res.booking.totalAmount),
          })
          .catch(() => undefined);
      }
      return res;
    });
  }

  async list(query: { status?: string; tourId?: string; search?: string; page?: number; perPage?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.perPage ?? 20));
    const where: Prisma.BookingWhereInput = {};
    if (query.status) where.status = query.status as Prisma.BookingWhereInput['status'];
    if (query.tourId) where.departure = { tourId: query.tourId };
    if (query.search) {
      where.OR = [
        { bookingNumber: { contains: query.search } },
        { customer: { phone: { contains: query.search } } },
        { customer: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { customer: { lastName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.db.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          customer: true,
          departure: { include: { tour: { select: { id: true, title: true, slug: true } } } },
          assignedManager: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.db.booking.count({ where }),
    ]);
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  }

  async byId(id: string) {
    const booking = await this.db.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        passengers: true,
        departure: { include: { tour: true, cities: { include: { departureCity: true } } } },
        departureCity: true,
        payments: true,
        statusHistory: { orderBy: { createdAt: 'asc' },  },
        assignedManager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!booking) throw new AppException('BOOKING_NOT_FOUND', 'Бронирование не найдено', 404);
    return booking;
  }

  /** Публичная страница подтверждения /booking/[id] — только по номеру заявки. */
  async byNumberPublic(bookingNumber: string) {
    const booking = await this.db.booking.findUnique({
      where: { bookingNumber },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        adults: true,
        children10to14: true,
        childrenUnder10: true,
        createdAt: true,
        departure: { select: { startDate: true, endDate: true, tour: { select: { title: true, slug: true } } } },
        departureCity: { select: { name: true, meetingInstructions: true } },
      },
    });
    if (!booking) throw new AppException('BOOKING_NOT_FOUND', 'Заявка с таким номером не найдена', 404);
    return booking;
  }

  /** Машина допустимых переходов статусов заявки (ТЗ §15). */
  private static readonly ALLOWED_TRANSITIONS: Record<string, string[]> = {
    NEW: ['CONTACTED', 'CONFIRMED', 'CANCELLED'],
    CONTACTED: ['PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED'],
    PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PAYMENT_PENDING', 'PAID', 'CANCELLED'],
    PAYMENT_PENDING: ['PAID', 'CANCELLED'],
    PAID: ['COMPLETED', 'REFUNDED'],
    CANCELLED: [],
    COMPLETED: [],
    REFUNDED: [],
  };

  async changeStatus(id: string, toStatus: string, userId: string, note?: string) {
    const booking = await this.db.booking.findUnique({ where: { id } });
    if (!booking) throw new AppException('BOOKING_NOT_FOUND', 'Бронирование не найдено', 404);
    const allowed = BookingsService.ALLOWED_TRANSITIONS[booking.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ConflictException(`Нельзя перевести заявку из ${booking.status} в ${toStatus}`);
    }
    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.booking.update({ where: { id }, data: { status: toStatus as BookingStatus } });
      await tx.bookingStatusHistory.create({ data: { bookingId: id, fromStatus: booking.status, toStatus: toStatus as BookingStatus, userId, note: note ?? null } });
      // При отмене/возврате освобождаем места атомарно.
      if (toStatus === 'CANCELLED' || toStatus === 'REFUNDED') {
        const seats = booking.adults + booking.children10to14 + booking.childrenUnder10;
        await tx.$executeRaw`
          UPDATE "Departure" SET "bookedSeats" = GREATEST("bookedSeats" - ${seats}, 0),
            status = CASE WHEN status = 'FULL' THEN 'OPEN' ELSE status END
          WHERE id = ${booking.departureId}::uuid`;
      }
      return updated;
    });
    return { previous: booking.status, current: result.status };
  }

  async assignManager(id: string, managerId: string) {
    const exists = await this.db.booking.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppException('BOOKING_NOT_FOUND', 'Бронирование не найдено', 404);
    const manager = await this.db.user.findFirst({ where: { id: managerId, isActive: true, deletedAt: null } });
    if (!manager) throw new AppException('NOT_FOUND', 'Менеджер не найден', 404);
    return this.db.booking.update({ where: { id }, data: { assignedManagerId: managerId }, select: { id: true, assignedManagerId: true } });
  }

  /** Комментарий менеджера: хранится в истории статусов как заметка без смены статуса. */
  async addComment(id: string, text: string, actorId: string) {
    const booking = await this.db.booking.findUnique({ where: { id } });
    if (!booking) throw new AppException('BOOKING_NOT_FOUND', 'Бронирование не найдено', 404);
    return this.db.bookingStatusHistory.create({
      data: { bookingId: id, fromStatus: booking.status, toStatus: booking.status, userId: actorId, note: text },
      select: { id: true, note: true, createdAt: true },
    });
  }
}
