import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Notification service (ТЗ §35–36).
 * Каналы: TELEGRAM / EMAIL / SYSTEM. Реальные внешние отправки включаются только
 * feature-флагами NOTIFY_TELEGRAM_ENABLED / NOTIFY_EMAIL_ENABLED (по умолчанию выкл.,
 * ТЗ §55). Запись Notification создаётся всегда — это и очередь, и аудит событий.
 */

export type NotificationEvent =
  | 'booking.created'
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'booking.paid'
  | 'departure.updated'
  | 'departure.tomorrow';

export interface NotifyInput {
  event: NotificationEvent;
  channel: NotificationChannel;
  title: string;
  body: string;
  bookingId?: string;
  /** email / telegram chatId / userId получателя */
  target?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get externalEnabled(): boolean {
    return (
      this.config.get<string>('NOTIFY_TELEGRAM_ENABLED') === 'true' ||
      this.config.get<string>('NOTIFY_EMAIL_ENABLED') === 'true'
    );
  }

  async notify(input: NotifyInput): Promise<{ id: string; status: string }> {
    if (!this.prisma.isHealthy()) {
      // Не блокируем бизнес-операцию (бронирование уже создано) — структурированный лог (§46).
      this.logger.warn({ msg: 'notification_skipped_no_db', event: input.event, channel: input.channel });
      return { id: '', status: 'SKIPPED' };
    }
    const record = await this.prisma.notification.create({
      data: {
        event: input.event,
        channel: input.channel,
        status: 'PENDING',
        target: input.target ?? null,
        bookingId: input.bookingId ?? null,
        payload: { title: input.title, body: input.body, ...(input.payload ?? {}) },
      },
      select: { id: true, status: true },
    });

    if (this.externalEnabled) {
      // Транспорт (Telegram Bot API / EmailService) подключается на Phase 10/11.
      this.logger.log({ msg: 'notification_dispatch_queued', id: record.id, event: input.event });
      return { id: record.id, status: 'PENDING' };
    }
    await this.prisma.notification.update({ where: { id: record.id }, data: { status: 'SKIPPED' } });
    return { id: record.id, status: 'SKIPPED' };
  }

  /** Событие booking.created: уведомление активных сотрудников-получателей (ТЗ §15). */
  async onBookingCreated(params: {
    bookingId: string;
    bookingNumber: string;
    tourTitle: string;
    customerName: string;
    seats: number;
    totalAmount: number;
  }): Promise<void> {
    let recipients: Array<{ id: string; email: string }> = [];
    if (this.prisma.isHealthy()) {
      recipients = await this.prisma.user.findMany({
        where: { isActive: true, deletedAt: null, role: { in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] } },
        select: { id: true, email: true },
      });
    }
    const title = 'Новая заявка';
    const body =
      `Заявка ${params.bookingNumber}: ${params.tourTitle}. ` +
      `Клиент: ${params.customerName}, мест: ${params.seats}, сумма: ${params.totalAmount.toLocaleString('ru-RU')} ₽.`;
    await Promise.all(
      recipients.map((u) =>
        this.notify({
          event: 'booking.created',
          channel: 'SYSTEM',
          title,
          body,
          bookingId: params.bookingId,
          target: u.id,
          payload: { bookingNumber: params.bookingNumber },
        }),
      ),
    );
  }
}
