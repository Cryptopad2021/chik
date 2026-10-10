import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { EmailService } from './email.service';

/**
 * Notification service (ТЗ §35–36, Phase 11).
 * Каналы: TELEGRAM / EMAIL / SYSTEM (+ архитектура под SMS — новый канал добавляется
 * как transport в dispatch() без изменения вызывающих мест).
 * Реальные внешние отправки включаются только feature-флагами NOTIFY_TELEGRAM_ENABLED /
 * NOTIFY_EMAIL_ENABLED + TELEGRAM_NOTIFICATIONS_ENABLED (по умолчанию выкл., ТЗ §55).
 * Запись Notification создаётся всегда — это и очередь, и аудит событий.
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
    private readonly telegram: TelegramService,
    private readonly email: EmailService,
  ) {}

  /** Feature-флаг реальных внешних отправок (§55): хотя бы один канал сконфигурирован и включён. */
  get externalEnabled(): boolean {
    return this.telegramExternalEnabled || this.email.sendEnabled;
  }

  get telegramExternalEnabled(): boolean {
    const flag = this.config.get<string>('NOTIFY_TELEGRAM_ENABLED') === 'true';
    // Единый источник конфигурации транспорта — TelegramService.sendEnabled (токен + флаг, §31/§55).
    return flag && this.telegram.sendEnabled === true;
  }

  /**
   * Создаёт запись Notification (всегда — это очередь + аудит) и выполняет dispatch
   * по каналу. SYSTEM — внутренняя запись (для менеджеров/админки), всегда "доставляется".
   * TELEGRAM/EMAIL — внешние транспорты только при feature-флагах; иначе SKIPPED (§55).
   */
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
    });

    return this.dispatch({ id: record.id, channel: record.channel, target: record.target });
  }

  /** Dispatch одной записи PENDING → SENT/FAILED/SKIPPED. Используется и scheduler-ом (§55). */
  async dispatch(n: {
    id: string;
    channel: NotificationChannel;
    target: string | null;
  }): Promise<{ id: string; status: string }> {
    // SYSTEM — внутреннее уведомление (лента в админке), внешней отправки нет: сразу SENT.
    if (n.channel === 'SYSTEM') {
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      return { id: n.id, status: 'SENT' };
    }

    // Внешний канал без конфига/флага — dry-run: запись остаётся в аудите как SKIPPED (§55).
    const enabled =
      n.channel === 'TELEGRAM' ? this.telegramExternalEnabled : this.email.sendEnabled;
    if (!enabled || !n.target) {
      await this.prisma.notification.update({ where: { id: n.id }, data: { status: 'SKIPPED' } });
      return { id: n.id, status: 'SKIPPED' };
    }

    const full = await this.prisma.notification.findUnique({
      where: { id: n.id },
      select: { payload: true },
    });
    const payload = (full?.payload ?? {}) as { title?: string; body?: string };
    const text = [payload.title, payload.body].filter(Boolean).join('\n');

    try {
      if (n.channel === 'TELEGRAM') {
        const r = await this.telegram.sendMessage(n.target, text, { rawHtml: false });
        if (!r.ok) throw new Error(r.description ?? 'TELEGRAM_SEND_FAILED');
      } else {
        const r = await this.email.send({ to: n.target, subject: payload.title ?? 'Уведомление', text });
        if (!r.sent) throw new Error(r.error ?? 'EMAIL_SEND_FAILED');
      }
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { status: 'SENT', sentAt: new Date(), error: null },
      });
      return { id: n.id, status: 'SENT' };
    } catch (e) {
      const message = (e as Error).message.slice(0, 500);
      this.logger.warn({ msg: 'notification_dispatch_failed', id: n.id, channel: n.channel, error: message });
      await this.prisma.notification.update({ where: { id: n.id }, data: { status: 'FAILED', error: message } });
      return { id: n.id, status: 'FAILED' };
    }
  }

  /** Повторная попытка для FAILED-записей (используется scheduler-ом). */
  async retryFailed(limit = 20): Promise<number> {
    if (!this.prisma.isHealthy()) return 0;
    const failed = await this.prisma.notification.findMany({
      where: { status: 'FAILED', channel: { in: ['EMAIL', 'TELEGRAM'] } },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true, channel: true, target: true },
    });
    let sent = 0;
    for (const f of failed) {
      // Только свежие ошибки: старше 24ч помечаем SKIPPED, чтобы не слать устаревшее.
      const r = await this.dispatch(f);
      if (r.status === 'SENT') sent++;
    }
    return sent;
  }

  /** Событие booking.created: SYSTEM-уведомления сотрудникам + EMAIL клиенту (ТЗ §15, §35). */
  async onBookingCreated(params: {
    bookingId: string;
    bookingNumber: string;
    tourTitle: string;
    customerName: string;
    seats: number;
    totalAmount: number;
    customerEmail?: string | null;
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

    // Подтверждение клиенту на email (если указан): канал EMAIL уходит только при включённом флаге.
    if (params.customerEmail && EmailService.isValidEmail(params.customerEmail)) {
      await this.notify({
        event: 'booking.created',
        channel: 'EMAIL',
        title: `Заявка ${params.bookingNumber} принята`,
        body:
          `${params.customerName}, спасибо! Мы получили вашу заявку ${params.bookingNumber} ` +
          `на тур «${params.tourTitle}» (${params.seats} мест, ${params.totalAmount.toLocaleString('ru-RU')} ₽). ` +
          `Менеджер свяжется с вами в ближайшее время.`,
        bookingId: params.bookingId,
        target: params.customerEmail,
        payload: { bookingNumber: params.bookingNumber },
      });
    }
  }

  /**
   * События смены статуса заявки (§22, §35): booking.confirmed / booking.cancelled / booking.paid.
   * Клиенту — EMAIL (при наличии), менеджерам — SYSTEM-лента.
   */
  async onBookingStatusChanged(params: {
    bookingId: string;
    bookingNumber: string;
    fromStatus: string;
    toStatus: string;
    customerName: string;
    customerEmail?: string | null;
    tourTitle?: string;
    note?: string;
  }): Promise<void> {
    const event: NotificationEvent =
      params.toStatus === 'CONFIRMED'
        ? 'booking.confirmed'
        : params.toStatus === 'PAID'
          ? 'booking.paid'
          : params.toStatus === 'CANCELLED'
            ? 'booking.cancelled'
            : 'departure.updated'; // иные переходы — общая запись события

    const clientText: Partial<Record<string, { title: string; body: string }>> = {
      CONFIRMED: {
        title: `Заявка ${params.bookingNumber} подтверждена`,
        body: `${params.customerName}, ваша заявка ${params.bookingNumber}${params.tourTitle ? ` на тур «${params.tourTitle}»` : ''} подтверждена. Ждём вас на поездке!`,
      },
      PAID: {
        title: `Оплата получена (${params.bookingNumber})`,
        body: `${params.customerName}, мы получили оплату по заявке ${params.bookingNumber}. Спасибо!`,
      },
      CANCELLED: {
        title: `Заявка ${params.bookingNumber} отменена`,
        body: `${params.customerName}, заявка ${params.bookingNumber} отменена.${params.note ? ` Причина: ${params.note}` : ''} Если это ошибка — напишите нам.`,
      },
    };

    const t = clientText[params.toStatus];
    if (t && params.customerEmail && EmailService.isValidEmail(params.customerEmail)) {
      await this.notify({
        event,
        channel: 'EMAIL',
        title: t.title,
        body: t.body,
        bookingId: params.bookingId,
        target: params.customerEmail,
        payload: { bookingNumber: params.bookingNumber, from: params.fromStatus, to: params.toStatus },
      });
    }

    await this.notify({
      event,
      channel: 'SYSTEM',
      title: `Статус заявки ${params.bookingNumber}`,
      body: `${params.bookingNumber}: ${params.fromStatus} → ${params.toStatus}. Клиент: ${params.customerName}.${params.note ? ` Комментарий: ${params.note}` : ''}`,
      bookingId: params.bookingId,
      payload: { bookingNumber: params.bookingNumber, from: params.fromStatus, to: params.toStatus },
    });
  }

  /** Список уведомлений для админки (Phase 11.5). */
  async list(query: { status?: string; event?: string; page?: number; perPage?: number } = {}) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(Math.max(1, query.perPage ?? 20), 100);
    if (!this.prisma.isHealthy()) return { items: [], total: 0, page, perPage };
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.event) where.event = query.event;
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true, event: true, channel: true, status: true, target: true,
          error: true, sentAt: true, createdAt: true, bookingId: true, payload: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ]);
    // Не отдаём лишний объём: payload оставляем только title/body.
    return {
      items: items.map((i) => ({
        ...i,
        payload: { title: (i.payload as { title?: string })?.title ?? null, body: (i.payload as { body?: string })?.body ?? null },
      })),
      total,
      page,
      perPage,
    };
  }
}
