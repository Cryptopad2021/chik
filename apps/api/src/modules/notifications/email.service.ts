import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * EmailService (ТЗ §36, Phase 11.2) — provider-agnostic отправка писем.
 *
 * Реальный транспорт включается только при конфигурации (§55):
 *  - SMTP_URL задан (smtp[s]://user:pass@host:port) → узел отправляет через nodemailer
 *    (подключается лениво: в dry-run-среде зависимость не нужна);
 *  - иначе EMAIL_WEBHOOK_URL → POST {to,subject,text} (интеграция с внешним сервисом);
 *  - иначе dry-run: письмо НЕ отправляется, возвращается sent:false (создаётся SYSTEM-запись).
 *
 * Credentials — только из env; пароли/токены в логи не пишутся (§46).
 */

export interface EmailSendInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSendResult {
  sent: boolean;
  dryRun: boolean;
  transport: 'smtp' | 'webhook' | 'none';
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  private env(key: string): string | undefined {
    return this.config.get<string>(key) || process.env[key] || undefined;
  }

  get smtpUrl(): string | undefined {
    return this.env('SMTP_URL');
  }

  get webhookUrl(): string | undefined {
    return this.env('EMAIL_WEBHOOK_URL');
  }

  /** Флаг реальных отправок: по умолчанию выкл., даже при настроенном транспорте (§55). */
  get sendEnabled(): boolean {
    return this.env('NOTIFY_EMAIL_ENABLED') === 'true' && (!!this.smtpUrl || !!this.webhookUrl);
  }

  static isValidEmail(email: string): boolean {
    return EMAIL_RE.test(email);
  }

  async send(input: EmailSendInput, fetchImpl?: typeof fetch): Promise<EmailSendResult> {
    if (!EmailService.isValidEmail(input.to)) {
      return { sent: false, dryRun: false, transport: 'none', error: 'INVALID_EMAIL' };
    }
    if (!this.sendEnabled) {
      // dry-run: структурированный лог без PII-деталей тела (§46, §55)
      this.logger.log({ msg: 'email_dry_run', to_domain: input.to.split('@')[1], subject: input.subject });
      return { sent: false, dryRun: true, transport: 'none' };
    }

    if (this.smtpUrl) {
      try {
        // Ленивая зависимость: nodemailer ставится только на боевых стендах.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport(this.smtpUrl);
        await transporter.sendMail({
          from: this.env('EMAIL_FROM') ?? 'no-reply@localhost',
          to: input.to,
          subject: input.subject,
          text: input.text,
          html: input.html,
        });
        return { sent: true, dryRun: false, transport: 'smtp' };
      } catch (e) {
        this.logger.warn({ msg: 'email_send_failed', transport: 'smtp', error: (e as Error).message });
        return { sent: false, dryRun: false, transport: 'smtp', error: (e as Error).message };
      }
    }

    try {
      const res = await (fetchImpl ?? globalThis.fetch)(this.webhookUrl!, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: input.to, subject: input.subject, text: input.text, html: input.html ?? null }),
      });
      if (!res.ok) {
        return { sent: false, dryRun: false, transport: 'webhook', error: `HTTP ${res.status}` };
      }
      return { sent: true, dryRun: false, transport: 'webhook' };
    } catch (e) {
      this.logger.warn({ msg: 'email_send_failed', transport: 'webhook', error: (e as Error).message });
      return { sent: false, dryRun: false, transport: 'webhook', error: (e as Error).message };
    }
  }
}
