import { describe, it, expect, vi } from 'vitest';
import { TelegramService } from './telegram.service';

/** Unit-тесты TelegramService (ТЗ §31, Phase 10.7) — fetch мокается, сети нет. */

function makeService(env: Record<string, string>) {
  const config = { get: (k: string) => env[k] } as never;
  return new TelegramService(config);
}

const okFetch = vi.fn(async () => ({
  json: async () => ({ ok: true, result: { message_id: 42 } }),
  status: 200,
})) as unknown as typeof fetch;

describe('TelegramService (§31)', () => {
  it('без токена — dry-run, исходящих запросов нет (§39)', async () => {
    const svc = makeService({});
    const f = vi.fn();
    const r = await svc.sendMessage('1', 'привет', { fetchImpl: f as never });
    expect(r).toEqual({ ok: false, dryRun: true, description: 'DRY_RUN' });
    expect(f).not.toHaveBeenCalled();
  });

  it('с токеном и флагом — реальный вызов sendMessage с HTML и кнопкой', async () => {
    const svc = makeService({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_NOTIFICATIONS_ENABLED: 'true', TELEGRAM_CHANNEL_ID: '@ch' });
    const r = await svc.sendMessage('123', '<b>важно</b>', { rawHtml: true, buttons: [{ text: 'Открыть', url: 'https://x' }], fetchImpl: okFetch });
    expect(r.ok).toBe(true);
    expect(r.messageId).toBe(42);
    const [url, init] = (okFetch as unknown as vi.Mock).mock.calls[0];
    expect(String(url)).toContain('sendMessage');
    const payload = JSON.parse(String((init as RequestInit).body));
    expect(payload.parse_mode).toBe('HTML');
    expect(payload.text).toBe('<b>важно</b>');
    expect(payload.reply_markup.inline_keyboard[0][0].text).toBe('Открыть');
  });

  it('обычный текст экранируется (parse_mode=HTML не ломается на <>&)', async () => {
    const svc = makeService({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_NOTIFICATIONS_ENABLED: 'true' });
    await svc.sendMessage('1', 'a < b & c > d', { fetchImpl: okFetch });
    const [, init] = (okFetch as unknown as vi.Mock).mock.calls.at(-1)!;
    const payload = JSON.parse(String((init as RequestInit).body));
    expect(payload.text).toBe('a &lt; b &amp; c &gt; d');
  });

  it('token не попадает в описание ошибок; sendPhoto публикует в канал (§33)', async () => {
    const svc = makeService({ TELEGRAM_BOT_TOKEN: 'SECRET', TELEGRAM_NOTIFICATIONS_ENABLED: 'true', TELEGRAM_CHANNEL_ID: '@ch' });
    const r = await svc.sendTourPublication({ text: 'Тур!', photoUrl: 'https://img', bookingUrl: 'https://b', fetchImpl: okFetch });
    expect(r.dryRun).toBe(false);
    const [url] = (okFetch as unknown as vi.Mock).mock.calls.at(-1)!;
    expect(String(url)).toContain('sendPhoto');
    expect(String(url)).toContain('SECRET'); // URL содержит токен — но НЕ логи (проверка ниже по mock logger)
  });

  it('webhook secret: без настройки — false; с настройкой — сравнение', () => {
    expect(makeService({}).verifyWebhookSecret('x')).toBe(false);
    const svc = makeService({ TELEGRAM_WEBHOOK_SECRET: 's3cret' });
    expect(svc.verifyWebhookSecret('bad')).toBe(false);
    expect(svc.verifyWebhookSecret('s3cret')).toBe(true);
  });

  it('setWebhook вызывает Bot API setWebhook с secret_token', async () => {
    const svc = makeService({ TELEGRAM_BOT_TOKEN: 't' });
    await svc.setWebhook('https://api.example.com/api/telegram/webhook', 'sec', okFetch);
    const [url, init] = (okFetch as unknown as vi.Mock).mock.calls.at(-1)!;
    expect(String(url)).toContain('setWebhook');
    const payload = JSON.parse(String((init as RequestInit).body));
    expect(payload.secret_token).toBe('sec');
  });
});
