import { Injectable } from '@nestjs/common';
import { BookingStatus, DepartureStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/app-exception';

/**
 * Дашборд админ-панели (ТЗ §19) + Customer CRM (§23).
 * Только агрегирующие read-запросы; запись не производится.
 */
@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    if (!this.prisma.isHealthy()) throw AppException.databaseUnavailable();
    return this.prisma;
  }

  /** Метрики за последние `days` дней (для графиков и «выручка/туристы»). */
  async dashboard(days = 30) {
    const since = new Date(Date.now() - days * 86400_000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(todayStart.getTime() + 2 * 86400_000);

    const ACTIVE_EXCLUDED: BookingStatus[] = [BookingStatus.CANCELLED, BookingStatus.REFUNDED];

    const [statusCounts, newTodayCount, revenueAgg, touristsAgg, upcomingRaw, recentBookings, recentAudit] =
      await Promise.all([
        this.db.booking.groupBy({ by: ['status'], _count: { _all: true } }),
        this.db.booking.count({ where: { createdAt: { gte: todayStart } } }),
        this.db.booking.aggregate({
          _sum: { totalAmount: true },
          _count: { _all: true },
          where: { status: { in: [BookingStatus.PAID, BookingStatus.COMPLETED] } },
        }),
        this.db.booking.aggregate({
          _sum: { adults: true, children10to14: true, childrenUnder10: true },
          where: { status: { notIn: ACTIVE_EXCLUDED } },
        }),
        this.db.departure.findMany({
          where: {
            startDate: { gte: todayStart, lt: tomorrowEnd },
            status: { in: [DepartureStatus.OPEN, DepartureStatus.ALMOST_FULL, DepartureStatus.FULL] },
          },
          include: { tour: { select: { id: true, title: true, slug: true } } },
          orderBy: { startDate: 'asc' },
        }),
        this.db.booking.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            bookingNumber: true,
            status: true,
            totalAmount: true,
            currency: true,
            createdAt: true,
            customerId: true,
            customer: { select: { id: true, firstName: true, lastName: true } },
            departure: { select: { startDate: true, tour: { select: { title: true } } } },
          },
        }),
        this.db.auditLog.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            entity: true,
            entityId: true,
            createdAt: true,
            user: { select: { firstName: true, lastName: true, role: true } },
          },
        }),
      ]);

    const countBy = (statuses: BookingStatus[]) =>
      statusCounts.reduce((acc, s) => (statuses.includes(s.status) ? acc + s._count._all : acc), 0);

    // Заполняемость ближайших выездов (все будущие OPEN/ALMOST_FULL/FULL)
    const fillDepartures = await this.db.departure.findMany({
      where: {
        startDate: { gte: todayStart },
        status: { in: [DepartureStatus.OPEN, DepartureStatus.ALMOST_FULL, DepartureStatus.FULL] },
      },
      select: { id: true, totalSeats: true, bookedSeats: true, startDate: true },
    });

    // Заметки менеджеров по клиентам последних заявок (§23)
    const customerIds = [...new Set(recentBookings.map((b) => b.customerId))];
    const customersNotes = customerIds.length
      ? await this.db.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, note: true } })
      : [];
    const noteById = new Map(customersNotes.map((c) => [c.id, c.note]));

    return {
      periodDays: days,
      cards: {
        newTotal: countBy([BookingStatus.NEW]),
        newToday: newTodayCount,
        contacted: countBy([BookingStatus.CONTACTED, BookingStatus.PENDING_CONFIRMATION]),
        confirmedActive: countBy([BookingStatus.CONFIRMED, BookingStatus.PAYMENT_PENDING]),
        paid: countBy([BookingStatus.PAID]),
        completed: countBy([BookingStatus.COMPLETED]),
        cancelled: countBy([BookingStatus.CANCELLED, BookingStatus.REFUNDED]),
        revenue: Number(revenueAgg._sum.totalAmount ?? 0),
        paidBookings: revenueAgg._count._all,
        tourists:
          (touristsAgg._sum.adults ?? 0) +
          (touristsAgg._sum.children10to14 ?? 0) +
          (touristsAgg._sum.childrenUnder10 ?? 0),
      },
      chart: await this.bookingsByDay(since),
      upcomingDepartures: upcomingRaw.map((d) => ({
        id: d.id,
        startDate: d.startDate,
        totalSeats: d.totalSeats,
        bookedSeats: d.bookedSeats,
        availableSeats: Math.max(0, d.totalSeats - d.bookedSeats),
        status: d.status,
        tour: d.tour,
      })),
      occupancy: (() => {
        const seats = fillDepartures.reduce((a, d) => a + d.totalSeats, 0);
        const booked = fillDepartures.reduce((a, d) => a + d.bookedSeats, 0);
        return {
          departures: fillDepartures.length,
          seats,
          booked,
          percent: seats ? Math.round((booked / seats) * 100) : 0,
        };
      })(),
      recentBookings: recentBookings.map((b) => ({ ...b, customerNote: noteById.get(b.customerId) ?? null })),
      recentActions: recentAudit,
    };
  }

  /** Заявки по дням за период (для графика на дашборде). */
  private async bookingsByDay(since: Date) {
    const rows = await this.db.booking.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, totalAmount: true, status: true },
    });
    const byDay = new Map<string, { date: string; count: number; revenue: number }>();
    for (const r of rows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      const bucket = byDay.get(key) ?? { date: key, count: 0, revenue: 0 };
      bucket.count += 1;
      if (r.status === BookingStatus.PAID || r.status === BookingStatus.COMPLETED) {
        bucket.revenue += Number(r.totalAmount);
      }
      byDay.set(key, bucket);
    }
    const out: { date: string; count: number; revenue: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(since.getTime() + i * 86400_000).toISOString().slice(0, 10);
      out.push(byDay.get(d) ?? { date: d, count: 0, revenue: 0 });
    }
    return out;
  }

  /** Список клиентов (CRM): поиск по телефону/имени/telegram, пагинация. */
  async customers(query: { search?: string; page?: number; perPage?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.perPage ?? 20));
    const where: Prisma.CustomerWhereInput = { deletedAt: null };
    if (query.search) {
      const s = query.search;
      where.OR = [
        { phone: { contains: s } },
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { telegramUsername: { contains: s, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.db.customer.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { _count: { select: { bookings: true, reviews: true } } },
      }),
      this.db.customer.count({ where }),
    ]);

    const agg = await this.db.booking.groupBy({
      by: ['customerId'],
      where: { customerId: { in: items.map((c) => c.id) } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });
    const aggMap = new Map(agg.map((a) => [a.customerId, a]));

    return {
      items: items.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        middleName: c.middleName,
        phone: c.phone,
        email: c.email,
        telegramUsername: c.telegramUsername,
        note: c.note,
        isDemo: c.isDemo,
        createdAt: c.createdAt,
        bookingsCount: c._count.bookings,
        reviewsCount: c._count.reviews,
        totalAmount: Number(aggMap.get(c.id)?._sum.totalAmount ?? 0),
      })),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  /** Профиль клиента: поездки, суммы, история статусов, комментарии менеджеров (§23). */
  async customerById(id: string) {
    const customer = await this.db.customer.findUnique({
      where: { id },
      include: { _count: { select: { reviews: true } } },
    });
    if (!customer || customer.deletedAt) {
      throw new AppException('CUSTOMER_NOT_FOUND', 'Клиент не найден', 404);
    }
    const bookings = await this.db.booking.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        departure: {
          select: { id: true, startDate: true, endDate: true, tour: { select: { id: true, title: true, slug: true } } },
        },
        departureCity: { select: { id: true, name: true } },
        assignedManager: { select: { id: true, firstName: true, lastName: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    const sums = bookings.reduce(
      (acc, b) => {
        acc.total += Number(b.totalAmount);
        if (b.status === BookingStatus.PAID || b.status === BookingStatus.COMPLETED) acc.paid += Number(b.totalAmount);
        if (b.status !== BookingStatus.CANCELLED && b.status !== BookingStatus.REFUNDED) {
          acc.tourists += b.adults + b.children10to14 + b.childrenUnder10;
        }
        return acc;
      },
      { total: 0, paid: 0, tourists: 0 },
    );
    return {
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        middleName: customer.middleName,
        phone: customer.phone,
        email: customer.email,
        telegramUserId: String(customer.telegramUserId ?? ''),
        telegramUsername: customer.telegramUsername,
        note: customer.note,
        isDemo: customer.isDemo,
        createdAt: customer.createdAt,
        reviewsCount: customer._count.reviews,
      },
      stats: {
        bookingsCount: bookings.length,
        totalAmount: sums.total,
        paidAmount: sums.paid,
        tourists: sums.tourists,
      },
      bookings: bookings.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        status: b.status,
        source: b.source,
        adults: b.adults,
        children10to14: b.children10to14,
        childrenUnder10: b.childrenUnder10,
        totalAmount: b.totalAmount,
        currency: b.currency,
        comment: b.comment,
        createdAt: b.createdAt,
        departure: b.departure,
        departureCity: b.departureCity,
        assignedManager: b.assignedManager,
        history: b.statusHistory.map((h) => ({
          id: h.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          note: h.note,
          createdAt: h.createdAt,
        })),
      })),
    };
  }

  /** Комментарий менеджера к профилю клиента (§23). */
  async updateCustomerNote(id: string, note: string | null) {
    const customer = await this.db.customer.findUnique({ where: { id } });
    if (!customer || customer.deletedAt) {
      throw new AppException('CUSTOMER_NOT_FOUND', 'Клиент не найден', 404);
    }
    return this.db.customer.update({
      where: { id },
      data: { note },
      select: { id: true, note: true, updatedAt: true },
    });
  }
}
