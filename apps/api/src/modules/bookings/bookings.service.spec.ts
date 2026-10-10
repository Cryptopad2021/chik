import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingsService } from './bookings.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { AppException } from '../../common/app-exception';
import type { CreateBookingDto } from './dto';

/**
 * Unit-тесты бизнес-логики бронирования (ТЗ §15–17, 54, 68).
 * Живой PostgreSQL в dev-среде недоступен, поэтому проверяется контракт сервиса
 * с транзакционным слоем: FOR UPDATE, условное списание мест, идемпотентность,
 * серверный пересчёт цены, машина переходов статусов, освобождение мест при отмене.
 * Интеграционный тест конкурентного overselling требует PG (docker-compose) — см. docs/PLAN.md.
 */

const DEP_ID = 'dep-1';
const CITY_ID = 'city-1';

function makeDto(overrides: Partial<CreateBookingDto> = {}): CreateBookingDto {
  return {
    departureId: DEP_ID,
    departureCityId: CITY_ID,
    customer: { firstName: 'Иван', lastName: 'Петров', phone: '+79001112233' },
    adults: 2,
    children10to14: 1,
    childrenUnder10: 0,
    passengers: [
      { firstName: 'Иван', lastName: 'Петров', passengerType: 'ADULT' },
      { firstName: 'Мария', lastName: 'Петрова', passengerType: 'ADULT' },
      { firstName: 'Сергей', lastName: 'Петров', passengerType: 'CHILD_10_TO_14' },
    ],
    source: 'WEBSITE',
    ...overrides,
  } as CreateBookingDto;
}

interface FakeDbConfig {
  totalSeats?: number;
  bookedSeats?: number;
  status?: string;
  tourExists?: boolean;
  cityPrice?: number | null;
}

function buildPrisma(cfg: FakeDbConfig = {}) {
  const totalSeats = cfg.totalSeats ?? 10;
  const bookedSeats = cfg.bookedSeats ?? 0;
  const state = { booked: bookedSeats, txCalled: false, forUpdateSql: '', updateSql: '' };

  const tx = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      state.forUpdateSql = sql;
      if (!sql.includes('FOR UPDATE')) throw new Error('Expected FOR UPDATE lock in seat query');
      if (!state.txCalled) throw new Error('$queryRaw must run inside transaction');
      return [{ id: DEP_ID, total_seats: totalSeats, booked_seats: state.booked, status: cfg.status ?? 'OPEN', tour_id: 'tour-1' }];
    }),
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...vals: unknown[]) => {
      const sql = strings.join('?');
      state.updateSql = sql;
      const needed = vals[vals.length - 1] as number;
      if (!sql.includes('"totalSeats" - "bookedSeats" >=') && !sql.includes('GREATEST')) {
        // seat decrement on cancel path uses GREATEST; booking path must use guarded condition
        throw new Error('Seat update must be conditional (atomic guard)');
      }
      if (sql.includes('SET "bookedSeats" = "bookedSeats" +')) {
        if (state.booked + needed > totalSeats) return 0; // atomic guard fails → no row updated
        state.booked += needed;
        return 1;
      }
      return 1;
    }),
    tour: { findUniqueOrThrow: vi.fn(async () => ({ id: 'tour-1', title: 'Тур', currency: 'RUB', adultPrice: 10000, basePrice: 10000, child10to14Price: 8000, childUnder10Price: 5000 })) },
    departure: {
      findUniqueOrThrow: vi.fn(async () => ({ id: DEP_ID, price: 12000, totalSeats, bookedSeats: state.booked })),
      findUnique: vi.fn(async () => ({ id: DEP_ID, tour: { title: 'Тур' } })),
      update: vi.fn(async () => ({})),
    },
    departureCityOnDeparture: { findUnique: vi.fn(async () => (cfg.cityPrice != null ? { price: cfg.cityPrice } : null)) },
    customer: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'cust-1' })),
    },
    booking: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async ({ data }: { data: { status: string } }) => ({ id: 'b-1', status: data.status })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'booking-1',
        bookingNumber: 'CHT-20261009-12345',
        status: 'NEW',
        ...data,
        passengers: data.passengers?.create ?? [],
      })),
    },
    bookingStatusHistory: { create: vi.fn(async () => ({})) },
  };

  const prisma = {
    isHealthy: () => true,
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
      state.txCalled = true;
      return fn(tx);
    }),
    ...tx,
  };
  const notifications = {
    onBookingCreated: vi.fn(async () => undefined),
    notify: vi.fn(async () => ({ id: 'n-1', status: 'SKIPPED' })),
  } as unknown as NotificationsService;
  return { prisma: prisma as never, tx, state, notifications };
}

describe('BookingsService.create — seat safety (ТЗ §54)', () => {
  let svc: BookingsService;
  let h: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    h = buildPrisma();
    svc = new BookingsService(h.prisma, h.notifications);
  });

  it('создаёт заявку внутри транзакции со строковой блокировкой FOR UPDATE', async () => {
    const res = await svc.create(makeDto());
    expect(h.state.txCalled).toBe(true);
    expect(h.state.forUpdateSql).toContain('FOR UPDATE');
    expect(res.replayed).toBe(false);
    expect(res.booking.status).toBe('NEW');
    expect(h.tx.booking.create).toHaveBeenCalled();
  });

  it('отклоняет бронирование, когда свободных мест меньше запрошенных (overselling protection)', async () => {
    h = buildPrisma({ totalSeats: 3, bookedSeats: 2 }); // available = 1, need = 3
    svc = new BookingsService(h.prisma, h.notifications);
    await expect(svc.create(makeDto())).rejects.toMatchObject({ code: 'SEATS_INSUFFICIENT' });
  });

  it('предварительная проверка отклоняет нехватку мест до UPDATE; при гонке спасает атомарный guard', async () => {
    h = buildPrisma({ totalSeats: 3, bookedSeats: 2 });
    svc = new BookingsService(h.prisma, h.notifications);
    const err = await svc.create(makeDto()).catch((e) => e);
    expect(err).toBeInstanceOf(AppException);
    expect((err as AppException).code).toBe('SEATS_INSUFFICIENT');
    // Сценарий гонки: предварительная проверка пропускает (мест "хватает"), но UPDATE с условием
    // не находит строк (параллельная транзакция уже забрала место) → SEATS_INSUFFICIENT.
    const hRace = buildPrisma({ totalSeats: 10, bookedSeats: 8 }); // available=2, need=3? нет: need=3 > 2 → сначала pre-check.
    // Для гонки делаем available >= need на чтении, но UPDATE всегда возвращает 0:
    (hRace.tx.$executeRaw as ReturnType<typeof vi.fn>).mockImplementation(async () => 0);
    const svcRace = new BookingsService(hRace.prisma, hRace.notifications);
    const dtoRace = makeDto({ adults: 2, children10to14: 0, passengers: [
      { firstName: 'A', lastName: 'B', passengerType: 'ADULT' },
      { firstName: 'C', lastName: 'D', passengerType: 'ADULT' },
    ] } as Partial<CreateBookingDto>);
    const errRace = await svcRace.create(dtoRace).catch((e) => e);
    expect(errRace).toBeInstanceOf(AppException);
    expect((errRace as AppException).code).toBe('SEATS_INSUFFICIENT');
    expect(hRace.tx.$executeRaw).toHaveBeenCalled();
  });

  it('нельзя бронировать на закрытый выезд (CANCELLED/FULL/COMPLETED)', async () => {
    for (const status of ['CANCELLED', 'FULL', 'COMPLETED']) {
      h = buildPrisma({ status });
      svc = new BookingsService(h.prisma, h.notifications);
      const err = await svc.create(makeDto()).catch((e) => e);
      expect(err).toBeInstanceOf(AppException);
    }
  });

  it('валидация: сумма пассажиров не соответствует типам', async () => {
    const dto = makeDto({ children10to14: 2 }); // passengers list has only 1 child
    await expect(svc.create(dto)).rejects.toBeInstanceOf(Error);
  });

  it('валидация: ноль участников', async () => {
    const dto = makeDto({ adults: 0, children10to14: 0, childrenUnder10: 0, passengers: [] });
    await expect(svc.create(dto)).rejects.toBeInstanceOf(Error);
  });
});

describe('BookingsService.create — pricing & idempotency (ТЗ §17, 68)', () => {
  it('цена считается на сервере: городская цена имеет приоритет над ценой выезда', async () => {
    const h = buildPrisma({ cityPrice: 15000 });
    const svc = new BookingsService(h.prisma, h.notifications);
    const res = await svc.create(makeDto());
    // 2 adults × 15000 + 1 child10 × 8000 = 38000
    expect(Number(res.booking.totalAmount)).toBe(38000);
  });

  it('без городской цены используется цена выезда', async () => {
    const h = buildPrisma({ cityPrice: null });
    const svc = new BookingsService(h.prisma, h.notifications);
    const res = await svc.create(makeDto());
    // 2×12000 + 1×8000 = 32000
    expect(Number(res.booking.totalAmount)).toBe(32000);
  });

  it('идемпотентный повтор возвращает существующую заявку без новой транзакции', async () => {
    const h = buildPrisma();
    const svc = new BookingsService(h.prisma, h.notifications);
    (h.tx.booking.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'existing-1',
      bookingNumber: 'CHT-20261009-00000',
      status: 'NEW',
      totalAmount: 100,
    });
    const res = await svc.create(makeDto({ idempotencyKey: 'key-123' }));
    expect(res.replayed).toBe(true);
    expect(res.booking.id).toBe('existing-1');
    expect(h.state.txCalled).toBe(false); // не списываем места повторно
  });
});

describe('BookingsService.changeStatus — transitions & seat release (ТЗ §14, 22)', () => {
  const existing = { id: 'b-1', status: 'CONFIRMED', departureId: DEP_ID, adults: 2, children10to14: 1, childrenUnder10: 0 };

  function buildForStatus(status: string) {
    const h = buildPrisma();
    (h.tx.booking.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ...existing, status });
    return h;
  }

  it('разрешённый переход NEW→CONTACTED пишет историю', async () => {
    const h = buildForStatus('NEW');
    const svc = new BookingsService(h.prisma, h.notifications);
    const r = await svc.changeStatus('b-1', 'CONTACTED', 'user-1');
    expect(r.previous).toBe('NEW');
    expect(h.tx.bookingStatusHistory.create).toHaveBeenCalled();
  });

  it('запрещённый переход PAID→NEW отклоняется ConflictException', async () => {
    const h = buildForStatus('PAID');
    const svc = new BookingsService(h.prisma, h.notifications);
    await expect(svc.changeStatus('b-1', 'NEW', 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('CANCELLED освобождает места атомарным UPDATE', async () => {
    const h = buildForStatus('CONFIRMED');
    const svc = new BookingsService(h.prisma, h.notifications);
    await svc.changeStatus('b-1', 'CANCELLED', 'user-1');
    const calls = (h.tx.$executeRaw as ReturnType<typeof vi.fn>).mock.calls;
    const cancelSql = calls.map((c) => (c[0] as TemplateStringsArray).join('?')).find((s) => s.includes('GREATEST'));
    expect(cancelSql).toBeDefined();
  });

  it('REFUNDED тоже освобождает места', async () => {
    const h = buildForStatus('PAID');
    const svc = new BookingsService(h.prisma, h.notifications);
    await svc.changeStatus('b-1', 'REFUNDED', 'user-1');
    const calls = (h.tx.$executeRaw as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c) => (c[0] as TemplateStringsArray).join('?').includes('GREATEST'))).toBe(true);
  });

  it('BOOKING_NOT_FOUND для несуществующей заявки', async () => {
    const h = buildPrisma(); // findUnique returns null
    const svc = new BookingsService(h.prisma, h.notifications);
    const err = await svc.changeStatus('missing', 'CONFIRMED', 'user-1').catch((e) => e);
    expect(err).toBeInstanceOf(AppException);
    expect((err as AppException).code).toBe('BOOKING_NOT_FOUND');
  });
});
