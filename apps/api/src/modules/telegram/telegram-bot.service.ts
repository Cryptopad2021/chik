import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService, InlineButton } from './telegram.service';
import { formatDateRu } from './template';
import { bookingsCreateViaCore } from './bookings-bridge';

/**
 * Bot-диалог бронирования в Telegram (ТЗ §32, Phase 10.3) + webhook-обработчик
 * входящих апдейтов (10.2/10.6).
 * FSM-состояния диалога держатся в памяти процесса (dev-допущение;
 * при горизонтальном масштабировании переносится в Redis — см. РЕЕСТР ОТКЛОНЕНИЙ).
 */
type WizardState =
  | { step: 'IDLE' }
  | { step: 'PICK_DESTINATION' }
  | { step: 'PICK_TOUR'; destinationId: string }
  | { step: 'PICK_DEPARTURE'; tourId: string }
  | { step: 'PICK_CITY'; departureId: string }
  | { step: 'ASK_SEATS'; departureId: string; departureCityId: string }
  | { step: 'ASK_PHONE'; departureId: string; departureCityId: string; adults: number }
  | { step: 'ASK_NAME'; departureId: string; departureCityId: string; adults: number; phone: string };

interface ChatSession {
  state: WizardState;
  updatedAt: number;
}

@Injectable()
export class TelegramBotService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramBotService.name);
  private sessions = new Map<string, ChatSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  /** Регистрация webhook при старте — только под feature-флагом (§55, ТЗ 10.2). */
  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('TELEGRAM_WEBHOOK_ENABLED') !== 'true') return;
    const publicUrl = this.config.get<string>('API_PUBLIC_URL') || process.env.API_PUBLIC_URL;
    const secret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET') || process.env.TELEGRAM_WEBHOOK_SECRET || '';
    if (!publicUrl) {
      this.logger.warn('TELEGRAM_WEBHOOK_ENABLED=true, но API_PUBLIC_URL не задан — webhook не зарегистрирован');
      return;
    }
    const r = await this.telegram.setWebhook(`${publicUrl}/api/telegram/webhook`, secret);
    this.logger.log({ msg: 'telegram_webhook_bootstrap', ok: r.ok, dryRun: r.dryRun, description: r.description });
  }

  private getSession(chatId: string): ChatSession {
    const s = this.sessions.get(chatId);
    // очистка протухших сессий (> 30 минут)
    if (s && Date.now() - s.updatedAt > 30 * 60_000) {
      this.sessions.delete(chatId);
      return { state: { step: 'IDLE' }, updatedAt: Date.now() };
    }
    return s ?? { state: { step: 'IDLE' }, updatedAt: Date.now() };
  }

  private setSession(chatId: string, state: WizardState): void {
    this.sessions.set(chatId, { state, updatedAt: Date.now() });
  }

  /**
   * Обработка апдейта. Секрет проверяет контроллер; здесь — логика бота (§32):
   * /start → направления → тур → дата → город → кол-во → телефон → имя → Booking(source=TELEGRAM).
   */
  async handleUpdate(update: Record<string, unknown>): Promise<void> {
    const message = update.message as
      | {
          chat?: { id?: number };
          text?: string;
          from?: { id?: number; username?: string; first_name?: string };
        }
      | undefined;
    if (!message?.chat?.id) return; // callback_query и прочие — вне скоупа базового ingest
    const chatId = String(message.chat.id);
    const text = (message.text ?? '').trim();
    const buttons: InlineButton[] = [];

    // команды
    if (text === '/start' || text.toLowerCase() === 'меню' || text === '/cancel') {
      this.setSession(chatId, { step: 'PICK_DESTINATION' });
      await this.reply(chatId, '👋 Добро пожаловать в Чиркей Тур! Выберите направление:', await this.destinationButtons());
      return;
    }

    const session = this.getSession(chatId);
    switch (session.state.step) {
      case 'PICK_DESTINATION': {
        const dest = await this.pickByIndex(await this.publishedDestinations(), text);
        if (!dest) {
          await this.reply(chatId, 'Отправьте номер направления из списка 👆');
          return;
        }
        this.setSession(chatId, { step: 'PICK_TOUR', destinationId: dest.id });
        await this.reply(chatId, `Направление «${dest.name}». Выберите тур:`, await this.tourButtons(dest.id));
        return;
      }
      case 'PICK_TOUR': {
        const st = session.state;
        const tour = await this.pickByIndex(await this.publishedTours(st.destinationId), text);
        if (!tour) {
          await this.reply(chatId, 'Отправьте номер тура из списка 👆');
          return;
        }
        this.setSession(chatId, { step: 'PICK_DEPARTURE', tourId: tour.id });
        await this.reply(chatId, `Тур «${tour.title}». Ближайшие даты:`, await this.departureButtons(tour.id));
        return;
      }
      case 'PICK_DEPARTURE': {
        const dep = await this.pickByIndex(await this.upcomingDepartures(session.state.tourId), text);
        if (!dep) {
          await this.reply(chatId, 'Отправьте номер даты из списка 👆');
          return;
        }
        this.setSession(chatId, { step: 'PICK_CITY', departureId: dep.id });
        const cities = await this.cityButtons(dep.id);
        if (cities.length === 0) {
          // нет привязанных городов — сразу к местам
          this.setSession(chatId, { step: 'ASK_SEATS', departureId: dep.id, departureCityId: '' });
          await this.reply(chatId, 'Сколько взрослых? (число)');
          return;
        }
        await this.reply(chatId, 'Выберите город отправления:', cities);
        return;
      }
      case 'PICK_CITY': {
        const city = await this.pickByIndex(await this.departureCities(session.state.departureId), text);
        if (!city) {
          await this.reply(chatId, 'Отправьте номер города из списка 👆');
          return;
        }
        this.setSession(chatId, { step: 'ASK_SEATS', departureId: session.state.departureId, departureCityId: city.id });
        await this.reply(chatId, 'Сколько взрослых? (число)');
        return;
      }
      case 'ASK_SEATS': {
        const n = Number(text);
        if (!Number.isInteger(n) || n < 1 || n > 20) {
          await this.reply(chatId, 'Введите целое число от 1 до 20.');
          return;
        }
        this.setSession(chatId, {
          step: 'ASK_PHONE', departureId: session.state.departureId, departureCityId: session.state.departureCityId, adults: n,
        });
        await this.reply(chatId, 'Отлично. Введите контактный телефон (например, +7 900 000-00-00):');
        return;
      }
      case 'ASK_PHONE': {
        if (!/^\+?[0-9\s\-()]{7,20}$/.test(text)) {
          await this.reply(chatId, 'Похоже, номер неверный. Формат: +7 900 000-00-00');
          return;
        }
        this.setSessionIdName(chatId, session.state, text);
        await this.reply(chatId, 'Как вас зовут? (Имя Фамилия)');
        return;
      }
      case 'ASK_NAME': {
        const parts = text.split(/\s+/);
        if (parts.length < 2 || !/^[А-Яа-яЁёA-Za-z-]+$/.test(parts[0])) {
          await this.reply(chatId, 'Напишите, пожалуйста, Имя и Фамилию.');
          return;
        }
        const st = session.state;
        const booking = await this.createTelegramBooking({
          chatId,
          userId: message.from?.id,
          username: message.from?.username,
          departureId: st.departureId,
          departureCityId: st.departureCityId,
          adults: st.adults,
          phone: st.phone,
          firstName: parts[0],
          lastName: parts[1],
        });
        this.setSession(chatId, { step: 'IDLE' });
        if (booking) {
          await this.reply(chatId,
            `✅ Заявка создана: ${booking.bookingNumber}\n` +
            `Статус: НОВАЯ. Менеджер свяжется с вами.\n${booking.url ? `Проверить заявку: ${booking.url}` : ''}`.trim(),
            buttons);
        } else {
          await this.reply(chatId, '😕 Не удалось создать заявку (нет свободных мест или сервис недоступен). Попробуйте позже или на сайте.');
        }
        return;
      }
      default: {
        this.setSession(chatId, { step: 'PICK_DESTINATION' });
        await this.reply(chatId, 'Отправьте /start, чтобы забронировать тур:', await this.destinationButtons());
      }
    }
  }

  private setSessionIdName(chatId: string, state: Extract<WizardState, { step: 'ASK_PHONE' }>, phone: string): void {
    this.setSession(chatId, {
      step: 'ASK_NAME',
      departureId: state.departureId,
      departureCityId: state.departureCityId,
      adults: state.adults,
      phone,
    });
  }

  /** Ответ наружу только если включена реальная отправка (§55); иначе — структурированный лог. */
  private async reply(chatId: string, text: string, buttons: InlineButton[] = []): Promise<void> {
    await this.telegram.sendMessage(chatId, text, buttons.length ? { buttons } : {});
  }

  private async publishedDestinations() {
    if (!this.prisma.isHealthy()) return [];
    return this.prisma.destination.findMany({
      where: { isActive: true, deletedAt: null, tours: { some: { status: 'PUBLISHED', deletedAt: null } } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
      take: 20,
    });
  }

  private async publishedTours(destinationId: string) {
    if (!this.prisma.isHealthy()) return [];
    return this.prisma.tour.findMany({
      where: { destinationId, status: 'PUBLISHED', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, slug: true },
      take: 20,
    });
  }

  private async upcomingDepartures(tourId: string) {
    if (!this.prisma.isHealthy()) return [];
    return this.prisma.departure.findMany({
      where: { tourId, startDate: { gte: new Date() }, status: { in: ['OPEN', 'ALMOST_FULL'] } },
      orderBy: { startDate: 'asc' },
      select: { id: true, startDate: true, totalSeats: true, bookedSeats: true },
      take: 10,
    });
  }

  private async departureCities(departureId: string) {
    if (!this.prisma.isHealthy()) return [];
    const rows = await this.prisma.departureCityOnDeparture.findMany({
      where: { departureId },
      include: { departureCity: { select: { id: true, name: true, isActive: true } } },
    });
    return rows.filter((r) => r.departureCity.isActive).map((r) => r.departureCity);
  }

  private async pickByIndex<T extends { id: string }>(items: T[], text: string): Promise<T | null> {
    const idx = Number(text.trim());
    if (!Number.isInteger(idx) || idx < 1 || idx > items.length) return null;
    return items[idx - 1];
  }

  private async destinationButtons() {
    const items = await this.publishedDestinations();
    return items.map((d, i) => ({ text: `${i + 1}. ${d.name}`, callback_data: `dest:${d.id}` }));
  }
  private async tourButtons(destinationId: string) {
    const items = await this.publishedTours(destinationId);
    return items.map((t, i) => ({ text: `${i + 1}. ${t.title}`, callback_data: `tour:${t.id}` }));
  }
  private async departureButtons(tourId: string) {
    const items = await this.upcomingDepartures(tourId);
    return items.map((d, i) => ({
      text: `${i + 1}. ${formatDateRu(d.startDate)} (${Math.max(d.totalSeats - d.bookedSeats, 0)} мест)`,
      callback_data: `dep:${d.id}`,
    }));
  }
  private async cityButtons(departureId: string) {
    const items = await this.departureCities(departureId);
    return items.map((c, i) => ({ text: `${i + 1}. ${c.name}`, callback_data: `city:${c.id}` }));
  }

  /**
   * Создание заявки из Telegram (ТЗ §32): source=TELEGRAM, telegramChatId,
   * Customer upsert по телефону/telegramUserId. Места списываются через общий
   * BookingsService.create — единая защита от overselling (§54) для сайта и бота.
   */
  async createTelegramBooking(params: {
    chatId: string;
    userId?: number;
    username?: string;
    departureId: string;
    departureCityId: string;
    adults: number;
    phone: string;
    firstName: string;
    lastName: string;
  }): Promise<{ bookingNumber: string; url?: string } | null> {
    if (!this.prisma.isHealthy()) return null;
    try {
      // идемпотентность на случай повторной обработки того же апдейта (§68)
      const key = `tg:${params.chatId}:${Date.now().toString(36)}`;
      const res = await bookingsCreateViaCore(this.prisma, this.telegram, {
        ...params,
        idempotencyKey: key,
      });
      const webUrl = this.config.get<string>('WEB_URL') || process.env.WEB_URL;
      return { bookingNumber: res.bookingNumber, url: webUrl ? `${webUrl}/booking/${res.bookingNumber}` : undefined };
    } catch (e) {
      this.logger.warn({ msg: 'telegram_booking_failed', chatId: params.chatId, error: (e as Error).message });
      return null;
    }
  }
}
