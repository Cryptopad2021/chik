import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * TelegramService (ТЗ §31, Phase 10.1) — обёртка над Bot API без внешних зависимостей.
 *
 * Правила безопасности:
 *  - credentials (TELEGRAM_BOT_TOKEN) только из env (§39); в логи токен не попадает (§46);
 *  - dry-run: если токен не задан или TELEGRAM_NOTIFICATIONS_ENABLED !== 'true',
 *    запрос НЕ отправляется наружу, а возвращается success:false с reason=DRY_RUN (§55).
 */

export interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TelegramSendResult {
  ok: boolean;
  /** true, если реальная отправка была пропущена (нет токена / флаг выключен) */
  dryRun: boolean;
  messageId?: number;
  description?: string;
}

interface ApiPayload {
  chat_id: string | number;
  text: string;
  parse_mode?: 'HTML';
  disable_web_page_preview?: boolean;
  reply_markup?: { inline_keyboard: InlineButton[][] };
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly config: ConfigService) {}

  get botToken(): string | undefined {
    return this.config.get<string>('TELEGRAM_BOT_TOKEN') || process.env.TELEGRAM_BOT_TOKEN || undefined;
  }

  /** Канал для публикаций (§33): @username или numeric id. */
  get channelId(): string | undefined {
    return this.config.get<string>('TELEGRAM_CHANNEL_ID') || process.env.TELEGRAM_CHANNEL_ID || undefined;
  }

  /** Реальные отправки включены только при токене + флаге (§55). */
  get sendEnabled(): boolean {
    return !!this.botToken && this.config.get<string>('TELEGRAM_NOTIFICATIONS_ENABLED') === 'true';
  }

  /** Экранирование для parse_mode=HTML (§31: текст может содержать данные клиентов). */
  static escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * низкоуровневый вызов Bot API method (sendMessage/sendPhoto/setWebhook…).
   * fetch инъектируется через параметр — тесты мокают его без сети (ТЗ 10.7).
   */
  async callApi<T = Record<string, unknown>>(
    method: string,
    payload: Record<string, unknown>,
    fetchImpl: typeof fetch = globalThis.fetch,
  ): Promise<{ ok: boolean; result?: T; description?: string; dryRun?: boolean }> {
    const token = this.botToken;
    if (!token) {
      // Без токена не делаем исходящих запросов вовсе (§39).
      return { ok: false, description: 'TELEGRAM_BOT_TOKEN is not configured', dryRun: true };
    }
    try {
      const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok: boolean;
        result?: T;
        description?: string;
      };
      // В лог — только method и статус, никогда токен/полный URL (§46).
      this.logger.log({ msg: 'telegram_api_call', method, ok: json.ok, status: res.status, description: json.description });
      return { ok: json.ok, result: json.result, description: json.description };
    } catch (e) {
      this.logger.warn({ msg: 'telegram_api_error', method, error: (e as Error).message });
      return { ok: false, description: (e as Error).message };
    }
  }

  /** Отправка текста (parse_mode=HTML, экранирование caller-текста внутри). */
  async sendMessage(
    chatId: string | number,
    text: string,
    opts: { buttons?: InlineButton[]; disablePreview?: boolean; rawHtml?: boolean; fetchImpl?: typeof fetch } = {},
  ): Promise<TelegramSendResult> {
    if (!this.sendEnabled) {
      this.logger.log({ msg: 'telegram_send_skipped', chatId: String(chatId), preview: text.slice(0, 80) });
      return { ok: false, dryRun: true, description: 'DRY_RUN' };
    }
    const payload: ApiPayload = {
      chat_id: chatId,
      text: opts.rawHtml ? text : TelegramService.escapeHtml(text),
      parse_mode: 'HTML',
      disable_web_page_preview: opts.disablePreview ?? true,
    };
    if (opts.buttons?.length) {
      payload.reply_markup = { inline_keyboard: [opts.buttons] };
    }
    const r = await this.callApi<{ message_id: number }>('sendMessage', payload as unknown as Record<string, unknown>, opts.fetchImpl ?? globalThis.fetch);
    return { ok: r.ok, dryRun: false, messageId: r.result?.message_id, description: r.description };
  }

  /** Фото с подписью (§33: публикация тура с фото). photoUrl — публичный URL или file_id. */
  async sendPhoto(
    chatId: string | number,
    photoUrl: string,
    caption: string,
    opts: { buttons?: InlineButton[]; fetchImpl?: typeof fetch } = {},
  ): Promise<TelegramSendResult> {
    if (!this.sendEnabled) {
      this.logger.log({ msg: 'telegram_photo_skipped', chatId: String(chatId) });
      return { ok: false, dryRun: true, description: 'DRY_RUN' };
    }
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      photo: photoUrl,
      caption: TelegramService.escapeHtml(caption),
      parse_mode: 'HTML',
    };
    if (opts.buttons?.length) payload.reply_markup = { inline_keyboard: [opts.buttons] };
    const r = await this.callApi<{ message_id: number }>('sendPhoto', payload, opts.fetchImpl ?? globalThis.fetch);
    return { ok: r.ok, dryRun: false, messageId: r.result?.message_id, description: r.description };
  }

  /** Уведомление менеджерам о новой заявке (§15, §31). */
  async sendBookingNotification(chatId: string | number, params: {
    bookingNumber: string;
    tourTitle: string;
    customerName: string;
    seats: number;
    totalAmount: number;
    source?: string;
  }): Promise<TelegramSendResult> {
    const text =
      `🆕 Новая заявка ${params.bookingNumber}\n` +
      `Тур: ${params.tourTitle}\n` +
      `Клиент: ${params.customerName}\n` +
      `Мест: ${params.seats}, сумма: ${params.totalAmount.toLocaleString('ru-RU')} ₽` +
      (params.source ? `\nИсточник: ${params.source}` : '');
    return this.sendMessage(chatId, text);
  }

  /** Уведомление о смене статуса заявки (§22, §31). */
  async sendStatusNotification(chatId: string | number, params: {
    bookingNumber: string;
    fromStatus: string;
    toStatus: string;
    note?: string;
  }): Promise<TelegramSendResult> {
    const text =
      `✳️ Заявка ${params.bookingNumber}: статус изменён ${params.fromStatus} → ${params.toStatus}` +
      (params.note ? `\nКомментарий: ${params.note}` : '');
    return this.sendMessage(chatId, text);
  }

  /** Публикация тура в канал (§33): готовый текст + кнопка «Забронировать». */
  async sendTourPublication(params: {
    text: string;
    photoUrl?: string | null;
    bookingUrl: string;
    chatId?: string | number;
    fetchImpl?: typeof fetch;
  }): Promise<TelegramSendResult> {
    const chat = params.chatId ?? this.channelId;
    if (!chat) return { ok: false, dryRun: true, description: 'TELEGRAM_CHANNEL_ID is not configured' };
    const buttons: InlineButton[] = [{ text: 'Забронировать', url: params.bookingUrl }];
    const fetchImpl = params.fetchImpl ?? globalThis.fetch;
    if (params.photoUrl) {
      return this.sendPhoto(chat, params.photoUrl, params.text, { buttons, fetchImpl });
    }
    return this.sendMessage(chat, params.text, { buttons, fetchImpl });
  }

  /** Напоминание о ближайшем выезде (§55, используется scheduler-ом Phase 11). */
  async sendReminder(chatId: string | number, text: string): Promise<TelegramSendResult> {
    return this.sendMessage(chatId, text);
  }

  /** Регистрация webhook при старте (Phase 10.2, feature flag TELEGRAM_WEBHOOK_ENABLED). */
  async setWebhook(url: string, secretToken: string, fetchImpl: typeof fetch = globalThis.fetch): Promise<TelegramSendResult> {
    const r = await this.callApi<boolean>(
      'setWebhook',
      { url, secret_token: secretToken, drop_pending_updates: false },
      fetchImpl,
    );
    return { ok: r.ok, dryRun: !!r.dryRun, description: r.description };
  }

  /** Проверка секрета webhook: сравнение строк без утечки значения в лог. */
  verifyWebhookSecret(received: string | undefined): boolean {
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET') || process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expected) return false; // секрет не настроен → webhook выключен
    return received === expected;
  }
}
