import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/app-exception';
import { TelegramService } from './telegram.service';
import { renderTemplate, formatDateRu, formatMoneyRu, DEFAULT_TELEGRAM_TEMPLATE, TEMPLATE_VARIABLES } from './template';

/**
 * Публикации туров в Telegram (ТЗ §33–34, Phase 10.4).
 * «Опубликовать в Telegram» из админа: рендер шаблона SiteSettings.telegramPostTemplate,
 * отправка фото+текста в канал, запись TelegramPost (status SENT/FAILED + telegramMessageId),
 * аудит TELEGRAM_PUBLISHED. При выключенном флаге — dry-run: пост остаётся DRAFT,
 * реальной отправки нет (§55).
 */

@Injectable()
export class TelegramPublicationService {
  private readonly logger = new Logger(TelegramPublicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  /** Контекст шаблона из реальных данных БД (цены/места — только backend, §17). */
  async buildContext(departureId: string): Promise<{
    ctx: Record<string, unknown>;
    photoUrl: string | null;
    template: string | null;
  }> {
    if (!this.prisma.isHealthy()) throw AppException.databaseUnavailable();
    const departure = await this.prisma.departure.findUnique({
      where: { id: departureId },
      include: {
        tour: {
          include: {
            destination: { select: { name: true } },
            images: { orderBy: { sortOrder: 'asc' }, select: { url: true, isCover: true } },
          },
        },
        cities: { include: { departureCity: { select: { name: true } } } },
      },
    });
    if (!departure) throw new AppException('DEPARTURE_NOT_FOUND', 'Выезд не найден', 404);
    const { destination, images, ...tour } = departure.tour;
    const availableSeats = Math.max(departure.totalSeats - departure.bookedSeats, 0);
    const webUrl = this.config.get<string>('WEB_URL') || process.env.WEB_URL || 'http://localhost:3000';
    const ctx = {
      tour: {
        title: tour.title,
        slug: tour.slug,
        shortDescription: tour.shortDescription,
        durationDays: tour.durationDays,
      },
      destination: { name: destination?.name ?? '' },
      departure: {
        startDate: formatDateRu(departure.startDate),
        endDate: formatDateRu(departure.endDate),
        price: formatMoneyRu(Number(departure.price)),
        availableSeats,
        totalSeats: departure.totalSeats,
        cities: departure.cities.map((c) => c.departureCity.name),
      },
      bookingUrl: `${webUrl}/tours/${tour.slug}`,
    };
    const cover = images.find((i) => i.isCover) ?? images[0];
    const settings = await this.prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });
    return { ctx, photoUrl: cover?.url ?? null, template: settings.telegramPostTemplate ?? null };
  }

  /** Preview без отправки и без записи поста (админский редактор шаблона, ТЗ 10.5). */
  async preview(departureId: string, templateOverride?: string | null) {
    const { ctx, photoUrl } = await this.buildContext(departureId);
    const text = renderTemplate(templateOverride ?? undefined, ctx);
    return { text, photoUrl, channel: this.telegram.channelId ?? null, sendEnabled: this.telegram.sendEnabled };
  }

  /**
   * Публикация выезда (§33). Создаёт TelegramPost(DRAFT) → отправляет → SENT/FAILED.
   * Ошибка отправки НЕ удаляет запись — она остаётся с статусом FAILED и error (аудит).
   */
  async publish(departureId: string, userId: string) {
    if (!this.prisma.isHealthy()) throw AppException.databaseUnavailable();
    const { ctx, photoUrl, template } = await this.buildContext(departureId);
    const text = renderTemplate(template, ctx);
    const departure = await this.prisma.departure.findUnique({
      where: { id: departureId },
      select: { tourId: true },
    });

    const post = await this.prisma.telegramPost.create({
      data: { tourId: departure?.tourId, departureId, text, photoUrl, status: 'DRAFT' },
    });

    const result = await this.telegram.sendTourPublication({
      text,
      photoUrl,
      bookingUrl: String(ctx.bookingUrl),
    });

    if (result.ok) {
      const updated = await this.prisma.telegramPost.update({
        where: { id: post.id },
        data: { status: 'SENT', telegramMessageId: String(result.messageId ?? ''), publishedAt: new Date(), error: null },
      });
      this.logger.log({ msg: 'telegram_published', postId: post.id, messageId: result.messageId, userId });
      return { post: updated, sent: true, dryRun: false };
    }

    const reason = result.dryRun ? 'DRY_RUN (флаг/токен не настроены)' : (result.description ?? 'unknown');
    const updated = await this.prisma.telegramPost.update({
      where: { id: post.id },
      data: { status: result.dryRun ? 'DRAFT' : 'FAILED', error: result.dryRun ? null : reason },
    });
    this.logger.warn({ msg: 'telegram_publish_not_sent', postId: post.id, reason });
    if (!result.dryRun) {
      throw new AppException('TELEGRAM_PUBLISH_FAILED', `Не удалось опубликовать в Telegram: ${reason}`, 502, { postId: post.id });
    }
    return { post: updated, sent: false, dryRun: true };
  }

  async listPosts(limit = 50) {
    if (!this.prisma.isHealthy()) return [];
    return this.prisma.telegramPost.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { tour: { select: { id: true, title: true, slug: true } } },
    });
  }

  /** Дефолтный шаблон + список переменных для редактора в админке (ТЗ 10.5). */
  templateInfo() {
    return { defaultTemplate: DEFAULT_TELEGRAM_TEMPLATE, variables: TEMPLATE_VARIABLES };
  }

  /**
   * Базовый ingest канала (ТЗ 10.6): публикация из канала (@forward_from / @forward_from_chat)
   * сохраняется как TelegramPost(sourceChannel) — канал становится источником контента.
   * Дедупликация по (chatId, messageId); ботские echo-ответы (from=isBot) игнорируются.
   */
  async ingestForwardedFromChannel(update: Record<string, unknown>): Promise<{ ingested: boolean; postId?: string; reason?: string }> {
    const message = update?.message as Record<string, unknown> | undefined;
    if (!message) return { ingested: false, reason: 'NO_MESSAGE' };

    const forwardFrom = (message.forward_from ?? null) as { is_bot?: boolean } | null;
    if (forwardFrom?.is_bot) return { ingested: false, reason: 'BOT_ECHO' };

    const forwardChat = (message.forward_from_chat ?? null) as { id?: number | string; username?: string } | null;
    const channelRaw = (message.sender_chat ?? forwardChat) as { id?: number | string; username?: string } | null;
    const channelId = typeof channelRaw === 'object' && channelRaw !== null ? String(channelRaw.id ?? '') : '';
    const channelUsername =
      typeof channelRaw === 'object' && channelRaw !== null ? (channelRaw.username ?? null) : null;
    if (!channelId) return { ingested: false, reason: 'NOT_FROM_CHANNEL' };

    const configured = this.telegram.channelId;
    const normalizedConfigured = configured ? configured.replace(/^@/, '').toLowerCase() : '';
    const matchesConfigured =
      !!normalizedConfigured &&
      (channelUsername?.toLowerCase() === normalizedConfigured || channelId === String(configured));
    const isNegativeChat = channelId.startsWith('-100') || channelId.startsWith('-'); // каналы имеют отрицательный id
    if (!matchesConfigured && !isNegativeChat) return { ingested: false, reason: 'OTHER_CHAT' };

    const text =
      (typeof message.text === 'string' && message.text) ||
      (typeof message.caption === 'string' && message.caption) ||
      '';
    if (!text.trim()) return { ingested: false, reason: 'NO_TEXT' };

    const messageId = String(message.message_id ?? '');
    if (!this.prisma.isHealthy()) return { ingested: false, reason: 'DB_UNAVAILABLE' };

    const photo = Array.isArray(message.photo) ? (message.photo as Array<{ file_id?: string }>).at(-1)?.file_id ?? null : null;

    const existing = await this.prisma.telegramPost.findFirst({ where: { telegramMessageId: messageId } });
    if (existing) return { ingested: false, reason: 'DUPLICATE', postId: existing.id };

    const post = await this.prisma.telegramPost.create({
      data: {
        text,
        photoUrl: photo,
        status: 'SENT',
        telegramMessageId: messageId,
        publishedAt: new Date((message.date as number ?? Math.floor(Date.now() / 1000)) * 1000),
        source: 'CHANNEL_INGEST',
        channelChatId: channelId,
        channelUsername,
      },
    });
    return { ingested: true, postId: post.id };
  }
}
