import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

/**
 * Scheduler уведомлений (ТЗ §55, Phase 11.4). Включается флагом SCHEDULER_ENABLED=true;
 * сами внешние отправки — только при feature-флагах каналов (§55), иначе SYSTEM/SKIPPED-запись.
 *
 * Задачи:
 *  - ежедневно 09:00 — напоминания о выездах через 7 дней и завтра (departure.tomorrow);
 *  - ежедневно 03:00 — закрытие прошедших выездов (SCHEDULED/PAST → COMPLETED) и
 *    отметка просроченных неоплаченных заявок;
 *  - каждый час — повторная попытка FAILED-уведомлений.
 */
@Injectable()
export class NotificationsSchedulerService {
  private readonly logger = new Logger(NotificationsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  get enabled(): boolean {
    return this.config.get<string>('SCHEDULER_ENABLED') === 'true' || process.env.SCHEDULER_ENABLED === 'true';
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDepartureReminders(): Promise<void> {
    if (!this.enabled || !this.prisma.isHealthy()) return;
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const windows: Array<{ label: string; days: number }> = [
      { label: 'через 7 дней', days: 7 },
      { label: 'завтра', days: 1 },
    ];
    let created = 0;
    for (const w of windows) {
      const from = new Date(now.getTime() + (w.days - 0.5) * dayMs);
      const to = new Date(now.getTime() + (w.days + 0.5) * dayMs);
      const departures = await this.prisma.departure.findMany({
        where: { startDate: { gte: from, lte: to }, status: { in: ['OPEN', 'ALMOST_FULL', 'FULL'] } },
        include: { tour: { select: { title: true, slug: true } }, bookings: { where: { status: { notIn: ['CANCELLED', 'REFUNDED'] } }, include: { customer: true } } },
      });
      for (const dep of departures) {
        const dateStr = dep.startDate.toISOString().slice(0, 10);
        // Клиентам — EMAIL (уедёт только при включённом канале), менеджерам — SYSTEM-лента.
        for (const b of dep.bookings) {
          const r = await this.notifications.notify({
            event: 'departure.tomorrow',
            channel: 'EMAIL',
            title: `Выезд «${dep.tour.title}» ${w.label}`,
            body: `${b.customer.firstName}, напоминаем: выезд «${dep.tour.title}» (${dateStr}) — ${w.label}. Место сбора: город отправления по вашей заявке ${b.bookingNumber}.`,
            bookingId: b.id,
            target: b.customer.email ?? undefined,
            payload: { departureId: dep.id, daysBefore: w.days },
          });
          if (r.status !== 'SKIPPED') created++;
        }
        await this.notifications.notify({
          event: 'departure.tomorrow',
          channel: 'SYSTEM',
          title: `Ближайший выезд: ${dep.tour.title}`,
          body: `Выезд «${dep.tour.title}» (${dateStr}) — ${w.label}. Активных заявок: ${dep.bookings.length}.`,
          payload: { departureId: dep.id, daysBefore: w.days },
        });
      }
    }
    this.logger.log({ msg: 'scheduler_reminders_done', notifications: created });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async closePastDepartures(): Promise<void> {
    if (!this.enabled || !this.prisma.isHealthy()) return;
    const yesterdayEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Прошедшие выезды закрываем (КОНЦЕПЦИЯ §55: авто-обслуживание данных).
    const closed = await this.prisma.departure.updateMany({
      where: { startDate: { lt: yesterdayEnd }, status: { in: ['OPEN', 'ALMOST_FULL', 'FULL'] } },
      data: { status: 'COMPLETED' },
    });
    // NEW-заявки старше 3 дней без подтверждения — сигнал менеджеру (не авто-отмена: места не трогаем).
    const stale = await this.prisma.booking.count({
      where: { status: 'NEW', createdAt: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
    });
    if (stale > 0) {
      await this.notifications.notify({
        event: 'booking.created',
        channel: 'SYSTEM',
        title: 'Просроченные заявки',
        body: `Заявок в статусе NEW старше 3 дней: ${stale}. Требуется обработка менеджером.`,
        payload: { staleCount: stale },
      });
    }
    this.logger.log({ msg: 'scheduler_cleanup_done', closedDepartures: closed.count, staleBookings: stale });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async retryFailedNotifications(): Promise<void> {
    if (!this.enabled) return;
    const sent = await this.notifications.retryFailed(20);
    if (sent > 0) this.logger.log({ msg: 'scheduler_retry_sent', count: sent });
  }
}
