import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeparturesCapacityService } from './departures-capacity.service';

/**
 * Unit-тесты атомарного пересчёта мест (ТЗ §12, §54) и защиты удаления (§6.3).
 * Живого PostgreSQL в dev нет — контракт с транзакционным слоем проверяется
 * through fake-prisma: FOR UPDATE обязателен, статус считается по остатку,
 * CANCELLED/COMPLETED не трогаются. Реальный конкурентный прогон — в e2e на PG (CI).
 */

const DEP_ID = 'dep-1';

interface FakeCfg {
  totalSeats?: number;
  status?: string;
  bookings?: Array<{ adults: number; children10to14: number; childrenUnder10: number; status: string }>;
}

function buildPrisma(cfg: FakeCfg = {}) {
  const totalSeats = cfg.totalSeats ?? 10;
  const status = cfg.status ?? 'OPEN';
  const bookings = cfg.bookings ?? [];
  const state = { forUpdateSql: '', txCalled: false, updated: undefined as undefined | Record<string, unknown> };

  const activeSum = () =>
    bookings
      .filter((b) => b.status !== 'CANCELLED' && b.status !== 'REFUNDED')
      .reduce((acc, b) => acc + b.adults + b.children10to14 + b.childrenUnder10, 0);

  const tx = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      state.forUpdateSql = sql;
      if (!sql.includes('FOR UPDATE')) throw new Error('Expected FOR UPDATE lock in recalc query');
      if (!state.txCalled) throw new Error('$queryRaw must run inside transaction');
      return [{ id: DEP_ID, total_seats: totalSeats, status }];
    }),
    booking: {
      aggregate: vi.fn(async () => {
        const s = activeSum();
        return { _sum: { adults: s, children10to14: 0, childrenUnder10: 0 } };
      }),
      count: vi.fn(async () => activeSum() > 0 ? bookings.filter((b) => b.status !== 'CANCELLED' && b.status !== 'REFUNDED').length : 0),
    },
    departure: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.updated = data;
        return { id: DEP_ID, ...data };
      }),
    },
  };

  const prisma = {
    isHealthy: () => true,
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
      state.txCalled = true;
      return fn(tx);
    }),
    ...tx,
  };

  const audit = { log: vi.fn(async () => undefined) };
  return { prisma: prisma as never, audit: audit as never, state, tx };
}

describe('DeparturesCapacityService.recalculate', () => {
  let h: ReturnType<typeof buildPrisma>;
  let svc: DeparturesCapacityService;

  beforeEach(() => {
    h = buildPrisma();
    svc = new DeparturesCapacityService(h.prisma, h.audit);
  });

  it('блокирует строку выезда через SELECT ... FOR UPDATE внутри транзакции', async () => {
    await svc.recalculate(DEP_ID, { userId: 'u-1' });
    expect(h.state.forUpdateSql).toContain('FOR UPDATE');
    expect(h.state.txCalled).toBe(true);
  });

  it('пересчитывает bookedSeats по активным броням и пишет OPEN при большом остатке', async () => {
    h = buildPrisma({ totalSeats: 10, bookings: [{ adults: 2, children10to14: 0, childrenUnder10: 0, status: 'CONFIRMED' }] });
    svc = new DeparturesCapacityService(h.prisma, h.audit);
    const res = await svc.recalculate(DEP_ID, { userId: 'u-1' });
    expect(res.bookedSeats).toBe(2);
    expect(res.availableSeats).toBe(8);
    expect(res.status).toBe('OPEN');
    expect(h.state.updated).toMatchObject({ bookedSeats: 2, status: 'OPEN' });
  });

  it('ставит ALMOST_FULL когда осталось <= 15% мест', async () => {
    // 10 мест, забронировано 9 → осталось 1 (<= ceil(10*0.15)=2)
    h = buildPrisma({ totalSeats: 10, bookings: [{ adults: 9, children10to14: 0, childrenUnder10: 0, status: 'NEW' }] });
    svc = new DeparturesCapacityService(h.prisma, h.audit);
    const res = await svc.recalculate(DEP_ID, { userId: 'u-1' });
    expect(res.status).toBe('ALMOST_FULL');
  });

  it('ставит FULL когда мест не осталось', async () => {
    h = buildPrisma({ totalSeats: 4, bookings: [{ adults: 4, children10to14: 0, childrenUnder10: 0, status: 'PAID' }] });
    svc = new DeparturesCapacityService(h.prisma, h.audit);
    const res = await svc.recalculate(DEP_ID, { userId: 'u-1' });
    expect(res.availableSeats).toBe(0);
    expect(res.status).toBe('FULL');
  });

  it('не меняет статус CANCELLED (ручное закрытие продаж сохраняется)', async () => {
    h = buildPrisma({ totalSeats: 10, status: 'CANCELLED', bookings: [] });
    svc = new DeparturesCapacityService(h.prisma, h.audit);
    const res = await svc.recalculate(DEP_ID, { userId: 'u-1' });
    expect(res.status).toBe('CANCELLED');
    expect(h.state.updated?.bookedSeats).toBe(0);
  });

  it('игнорирует CANCELLED/REFUNDED заявки при суммировании', async () => {
    h = buildPrisma({
      totalSeats: 10,
      bookings: [
        { adults: 3, children10to14: 0, childrenUnder10: 0, status: 'CONFIRMED' },
        { adults: 5, children10to14: 0, childrenUnder10: 0, status: 'CANCELLED' },
        { adults: 2, children10to14: 0, childrenUnder10: 0, status: 'REFUNDED' },
      ],
    });
    svc = new DeparturesCapacityService(h.prisma, h.audit);
    const res = await svc.recalculate(DEP_ID, { userId: 'u-1' });
    expect(res.bookedSeats).toBe(3);
  });

  it('пишет DEPARTURE_SEATS_RECALCULATED в аудит', async () => {
    await svc.recalculate(DEP_ID, { userId: 'u-1', reason: 'manual_endpoint' });
    expect(h.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEPARTURE_SEATS_RECALCULATED', entityId: DEP_ID }),
    );
  });
});

describe('DeparturesCapacityService.assertNoActiveBookings (§6.3)', () => {
  it('пропускает когда активных заявок нет', async () => {
    const h = buildPrisma({ bookings: [] });
    const svc = new DeparturesCapacityService(h.prisma, h.audit);
    await expect(svc.assertNoActiveBookings(DEP_ID, false)).resolves.toEqual({ blocked: false, activeCount: 0 });
  });

  it('блокирует удаление без confirm=true', async () => {
    const h = buildPrisma({ bookings: [{ adults: 1, children10to14: 0, childrenUnder10: 0, status: 'NEW' }] });
    const svc = new DeparturesCapacityService(h.prisma, h.audit);
    await expect(svc.assertNoActiveBookings(DEP_ID, false)).rejects.toBeInstanceOf(ConflictException);
  });

  it('разрешает с confirm=true (для override с аудитом)', async () => {
    const h = buildPrisma({ bookings: [{ adults: 1, children10to14: 0, childrenUnder10: 0, status: 'NEW' }] });
    const svc = new DeparturesCapacityService(h.prisma, h.audit);
    await expect(svc.assertNoActiveBookings(DEP_ID, true)).resolves.toMatchObject({ blocked: true, activeCount: 1 });
  });
});
