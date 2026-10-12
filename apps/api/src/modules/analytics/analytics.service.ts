import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ANALYTICS_EVENT_TYPES, findPiiKeys } from './analytics.constants';
import { TrackEventDto } from './dto';
import { cached } from '../../common/cache';

/**
 * Сбор и агрегация событий аналитики (ТЗ §71–73).
 * §72: события принимаются только из белого списка типов; metadata не должна содержать ПДн —
 * такие события отбрасываются (с логом), ничего не записывается.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma;
  }

  /** Запись одного события. Возвращает id записи или null, если событие отклонено. */
  async track(event: TrackEventDto): Promise<{ accepted: boolean; reason?: string }> {
    if (!(ANALYTICS_EVENT_TYPES as readonly string[]).includes(event.type)) {
      return { accepted: false, reason: 'UNKNOWN_EVENT_TYPE' };
    }
    const piiKeys = findPiiKeys(event.metadata ?? null);
    if (piiKeys.length > 0) {
      this.logger.warn(
        JSON.stringify({ msg: 'analytics_rejected_pii', type: event.type, keys: piiKeys }),
      );
      return { accepted: false, reason: 'PII_IN_METADATA' };
    }
    await this.db.analyticsEvent.create({
      data: {
        type: event.type,
        tourId: event.tourId ?? null,
        departureId: event.departureId ?? null,
        bookingId: event.bookingId ?? null,
        sessionId: event.sessionId ?? null,
        utmSource: event.utmSource ?? null,
        utmMedium: event.utmMedium ?? null,
        utmCampaign: event.utmCampaign ?? null,
        path: event.path ?? null,
        metadata: (event.metadata ?? undefined) as never,
      },
    });
    return { accepted: true };
  }

  /** Пакетная запись (клиент батчит события). Ограничение — 50 событий за запрос. */
  async trackBatch(events: TrackEventDto[]) {
    const limited = events.slice(0, 50);
    const results = await Promise.all(limited.map((e) => this.track(e)));
    return {
      received: limited.length,
      accepted: results.filter((r) => r.accepted).length,
      rejected: results.filter((r) => !r.accepted).length,
    };
  }

  /** Внутренний хелпер для серверных событий (не падает при ошибке БД). */
  async safeTrack(event: Partial<TrackEventDto> & { type: string }) {
    try {
      await this.track(event as TrackEventDto);
    } catch (e) {
      this.logger.warn(JSON.stringify({ msg: 'analytics_track_failed', type: event.type, error: String(e) }));
    }
  }

  // ===== Агрегация (ТЗ 12.2 / §73) =====

  /** Воронка: view_tour → select_departure → start_booking → booking_created → booking_confirmed. */
  async funnel(days: number) {
    return cached(`an:funnel:${days}`, 60_000, () => this.funnelUncached(days));
  }

  private async funnelUncached(days: number) {
    const since = new Date(Date.now() - days * 86400_000);
    const types = ['view_tour', 'select_departure', 'start_booking', 'booking_created', 'booking_confirmed'];
    const grouped = await this.db.analyticsEvent.groupBy({
      by: ['type'],
      where: { createdAt: { gte: since }, type: { in: types } },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(types.map((t) => [t, grouped.find((g) => g.type === t)?._count._all ?? 0]));
    const steps = types.map((t) => ({ step: t, count: counts[t] as number }));
    const first = (counts.view_tour as number) || 0;
    const last = (counts.booking_confirmed as number) || 0;
    return {
      since: since.toISOString(),
      steps,
      conversion: first > 0 ? Number(((last / first) * 100).toFixed(2)) : null,
    };
  }

  /** События по дням (для графиков). */
  async eventsByDay(days: number, type?: string) {
    return cached(`an:byday:${days}:${type ?? 'all'}`, 60_000, () => this.eventsByDayUncached(days, type));
  }

  private async eventsByDayUncached(days: number, type?: string) {
    const since = new Date(Date.now() - days * 86400_000);
    const rows = await this.db.$queryRaw<Array<{ day: Date; type: string; count: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS day, type, COUNT(*)::bigint AS count
      FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${since} AND (${type ?? null}::text IS NULL OR type = ${type ?? null})
      GROUP BY 1, 2 ORDER BY 1`;
    return rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), type: r.type, count: Number(r.count) }));
  }

  /** Топ туров по просмотрам/выбору дат. */
  async topTours(days: number, limit = 10) {
    return cached(`an:top:${days}:${limit}`, 60_000, () => this.topToursUncached(days, limit));
  }

  private async topToursUncached(days: number, limit = 10) {
    const since = new Date(Date.now() - days * 86400_000);
    const rows = await this.db.$queryRaw<Array<{ tourId: string; views: bigint; selects: bigint; created: bigint }>>`
      SELECT "tourId",
             COUNT(*) FILTER (WHERE type = 'view_tour')::bigint AS views,
             COUNT(*) FILTER (WHERE type = 'select_departure')::bigint AS selects,
             COUNT(*) FILTER (WHERE type = 'booking_created')::bigint AS created
      FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${since} AND "tourId" IS NOT NULL
      GROUP BY "tourId" ORDER BY views DESC LIMIT ${limit}`;
    const tourIds = rows.map((r) => r.tourId);
    const tours = await this.db.tour.findMany({ where: { id: { in: tourIds } }, select: { id: true, title: true } });
    const byId = new Map(tours.map((t) => [t.id, t.title]));
    return rows.map((r) => ({
      tourId: r.tourId,
      title: byId.get(r.tourId) ?? '(удалён)',
      views: Number(r.views),
      selects: Number(r.selects),
      created: Number(r.created),
    }));
  }

  /** UTM-разрез: заявки с рекламных меток. */
  async utmBreakdown(days: number) {
    return cached(`an:utm:${days}`, 60_000, () => this.utmBreakdownUncached(days));
  }

  private async utmBreakdownUncached(days: number) {
    const since = new Date(Date.now() - days * 86400_000);
    const grouped = await this.db.analyticsEvent.groupBy({
      by: ['utmSource', 'utmMedium', 'utmCampaign'],
      where: { createdAt: { gte: since }, utmSource: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { utmSource: 'desc' } },
      take: 30,
    });
    return grouped.map((g) => ({
      utmSource: g.utmSource,
      utmMedium: g.utmMedium,
      utmCampaign: g.utmCampaign,
      count: g._count._all,
    }));
  }

  /** Telegram-активность: клики по кнопкам публикаций + события TG_BOT. */
  async telegramStats(days: number) {
    return cached(`an:tg:${days}`, 60_000, () => this.telegramStatsUncached(days));
  }

  private async telegramStatsUncached(days: number) {
    const since = new Date(Date.now() - days * 86400_000);
    const [clicks, posts] = await Promise.all([
      this.db.analyticsEvent.count({ where: { createdAt: { gte: since }, type: 'telegram_click' } }),
      this.db.telegramPost.count({ where: { createdAt: { gte: since } } }),
    ]);
    return { telegramClicks: clicks, publications: posts };
  }
}
