import { describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics.service';
import { findPiiKeys } from './analytics.constants';

/**
 * Unit-тесты аналитики (ТЗ §71–73, 12.4):
 * — whitelist типов событий;
 * — отбрасывание событий с ПДн в metadata (§72);
 * — батч с ограничением 50;
 * — safeTrack не бросает при ошибке БД.
 */

function buildPrisma(overrides: Record<string, unknown> = {}) {
  return {
    analyticsEvent: {
      create: vi.fn(async () => ({ id: 'ev-1' })),
      count: vi.fn(async () => 5),
      groupBy: vi.fn(async () => []),
    },
    telegramPost: { count: vi.fn(async () => 2) },
    tour: { findMany: vi.fn(async () => []) },
    $queryRaw: vi.fn(async () => []),
    ...overrides,
  } as never;
}

describe('AnalyticsService.track — whitelist и ПДн (ТЗ §71–72)', () => {
  it('принимает событие из белого списка и пишет его в БД', async () => {
    const prisma = buildPrisma();
    const svc = new AnalyticsService(prisma);
    const res = await svc.track({ type: 'view_tour', tourId: 't-1', sessionId: 's-1', utmSource: 'vk' });
    expect(res).toEqual({ accepted: true });
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'view_tour', utmSource: 'vk' }) }),
    );
  });

  it('отклоняет неизвестный тип события, ничего не записывая', async () => {
    const prisma = buildPrisma();
    const svc = new AnalyticsService(prisma);
    const res = await svc.track({ type: 'steal_cookies' } as never);
    expect(res.accepted).toBe(false);
    expect(res.reason).toBe('UNKNOWN_EVENT_TYPE');
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it('отклоняет событие, если metadata содержит ключ-ПДн (phone)', async () => {
    const prisma = buildPrisma();
    const svc = new AnalyticsService(prisma);
    const res = await svc.track({ type: 'start_booking', metadata: { phone: '+79001112233' } });
    expect(res.accepted).toBe(false);
    expect(res.reason).toBe('PII_IN_METADATA');
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it('findPiiKeys находит ПДн рекурсивно, включая вложенность и массивы', () => {
    expect(findPiiKeys({ a: { b: [{ email: 'x@y.z' }] } })).toEqual(['email']);
    expect(findPiiKeys({ firstName: 'Иван' })).toEqual(['firstName']);
    expect(findPiiKeys({ color: 'red', depth: 3 })).toEqual([]);
    expect(findPiiKeys(null)).toEqual([]);
  });
});

describe('AnalyticsService.trackBatch и safeTrack', () => {
  it('батч считает принятые/отклонённые и ограничивает 50 событиями', async () => {
    const prisma = buildPrisma();
    const svc = new AnalyticsService(prisma);
    const events = Array.from({ length: 60 }, (_, i) =>
      i === 0 ? ({ type: 'bad_type' } as never) : ({ type: 'view_tour' } as never),
    );
    const res = await svc.trackBatch(events);
    expect(res.received).toBe(50); // 60 урезано до 50
    expect(res.accepted).toBe(49);
    expect(res.rejected).toBe(1);
  });

  it('safeTrack глотает ошибку БД (аналитика не должна ронять бизнес-операции)', async () => {
    const prisma = buildPrisma({
      analyticsEvent: { create: vi.fn(async () => { throw new Error('DB down'); }) },
    });
    const svc = new AnalyticsService(prisma);
    await expect(svc.safeTrack({ type: 'booking_created' })).resolves.toBeUndefined();
  });
});

describe('AnalyticsService.funnel (ТЗ 12.2)', () => {
  it('считает шаги воронки и конверсию view→confirmed', async () => {
    const groupBy = vi.fn(async () => [
      { type: 'view_tour', _count: { _all: 100 } },
      { type: 'select_departure', _count: { _all: 40 } },
      { type: 'start_booking', _count: { _all: 20 } },
      { type: 'booking_created', _count: { _all: 10 } },
      { type: 'booking_confirmed', _count: { _all: 5 } },
    ]);
    const svc = new AnalyticsService(buildPrisma({ analyticsEvent: { groupBy, create: vi.fn() } }));
    const res = await svc.funnel(30);
    expect(res.steps.map((s) => s.count)).toEqual([100, 40, 20, 10, 5]);
    expect(res.conversion).toBe(5); // 5/100 = 5%
  });

  it('конверсия null при нулевых просмотрах (деление на ноль)', async () => {
    const svc = new AnalyticsService(buildPrisma());
    const res = await svc.funnel(7);
    expect(res.conversion).toBeNull();
    expect(res.steps.every((s) => s.count === 0)).toBe(true);
  });
});
