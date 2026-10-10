import { describe, it, expect, vi } from 'vitest';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';

/** Unit-тесты уведомлений (ТЗ §35–36, Phase 11.6): dry-run по умолчанию (§55), каналы, retry. */

interface DbState {
  created: Record<string, unknown>[];
  updates: Record<string, unknown>[];
}

function makeDb(state: DbState, healthy = true) {
  return {
    isHealthy: () => healthy,
    notification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const rec = { id: `n${state.created.length + 1}`, ...data };
        state.created.push(rec);
        return rec;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        state.updates.push({ id: where.id, ...data });
        const rec = state.created.find((c) => c.id === where.id) as Record<string, unknown> | undefined;
        if (rec) Object.assign(rec, data);
        return rec;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const rec = state.created.find((c) => c.id === where.id) as Record<string, unknown> | undefined;
        return rec ? { payload: rec.payload } : null;
      },
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    user: { findMany: vi.fn(async () => []) },
  };
}

function makeService(
  env: Record<string, string> = {},
  overrides: { telegram?: Partial<{ sendMessage: (...a: never[]) => unknown }>; email?: Partial<EmailService> } = {},
) {
  const state: DbState = { created: [], updates: [] };
  const db = makeDb(state);
  const config = { get: (k: string) => env[k] || process.env[k] } as never;
  const telegram = {
    sendMessage: vi.fn(async () => ({ ok: true, messageId: '1' })),
    sendEnabled: env['NOTIFY_TELEGRAM_ENABLED'] === 'true' && env['TELEGRAM_BOT_TOKEN'] === 't',
    ...overrides.telegram,
  } as never;
  const emailDefault = new EmailService(config);
  const email = Object.assign(emailDefault, overrides.email ?? {});
  const svc = new NotificationsService(db as never, config, telegram, email as never);
  return { svc, state, db, telegram, email };
}

describe('NotificationsService (§35)', () => {
  it('SYSTEM — всегда SENT без внешней отправки', async () => {
    const { svc, state } = makeService();
    const r = await svc.notify({ event: 'booking.created', channel: 'SYSTEM', title: 'T', body: 'B' });
    expect(r.status).toBe('SENT');
    // create пишется в PENDING (очередь), dispatch переводит в SENT (update)
    expect(state.created[0]).toMatchObject({ channel: 'SYSTEM' });
    expect(state.updates.some((u) => u.status === 'SENT')).toBe(true);
  });

  it('EMAIL без конфига — SKIPPED (dry-run, §55); письмо не отправлено', async () => {
    const { svc, state } = makeService({});
    const r = await svc.notify({ event: 'booking.created', channel: 'EMAIL', title: 'T', body: 'B', target: 'a@b.co' });
    expect(r.status).toBe('SKIPPED');
    expect(state.updates.at(-1)).toMatchObject({ status: 'SKIPPED' });
  });

  it('EMAIL с флагом и webhook — реальный send, статус SENT', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
    const { svc, state } = makeService(
      { NOTIFY_EMAIL_ENABLED: 'true', EMAIL_WEBHOOK_URL: 'https://hook' },
      { email: { send: async (i: { to: string }) => ({ sent: i.to === 'ok@x.io', dryRun: false, transport: 'webhook' as const }) } },
    );
    const r = await svc.notify({ event: 'booking.paid', channel: 'EMAIL', title: 'Оплата', body: 'Получено', target: 'ok@x.io' });
    expect(r.status).toBe('SENT');
    expect(state.updates.at(-1)).toMatchObject({ status: 'SENT' });
    void fetchImpl;
  });

  it('EMAIL ошибка транспорта — FAILED + текст ошибки в записи', async () => {
    const { svc, state } = makeService(
      { NOTIFY_EMAIL_ENABLED: 'true', EMAIL_WEBHOOK_URL: 'https://hook' },
      { email: { send: async () => ({ sent: false, dryRun: false, transport: 'webhook' as const, error: 'SMTP_500' }) } },
    );
    const r = await svc.notify({ event: 'booking.confirmed', channel: 'EMAIL', title: 'T', body: 'B', target: 'a@b.co' });
    expect(r.status).toBe('FAILED');
    expect(state.updates.at(-1)).toMatchObject({ status: 'FAILED', error: 'SMTP_500' });
  });

  it('TELEGRAM включённый флаг — sendMessage на target-chatId', async () => {
    const { svc, telegram } = makeService({
      NOTIFY_TELEGRAM_ENABLED: 'true',
      TELEGRAM_NOTIFICATIONS_ENABLED: 'true',
      TELEGRAM_BOT_TOKEN: 't',
    });
    const r = await svc.notify({ event: 'departure.tomorrow', channel: 'TELEGRAM', title: 'За', body: 'втра', target: '555' });
    expect(r.status).toBe('SENT');
    expect(telegram.sendMessage).toHaveBeenCalledWith('555', 'За\nвтра', { rawHtml: false });
  });

  it('notify без БД — SKIPPED и нет броска (бронирование не должно падать)', async () => {
    const state: DbState = { created: [], updates: [] };
    const db = makeDb(state, false);
    const config = { get: () => undefined } as never;
    const svc = new NotificationsService(db as never, config, {} as never, new EmailService(config) as never);
    const r = await svc.notify({ event: 'booking.created', channel: 'SYSTEM', title: 'T', body: 'B' });
    expect(r).toEqual({ id: '', status: 'SKIPPED' });
  });

  it('onBookingCreated: SYSTEM сотрудникам + EMAIL клиенту при валидном email', async () => {
    const { svc, state, db } = makeService();
    (db.user.findMany as vi.Mock).mockResolvedValueOnce([
      { id: 'u1', email: 'admin@x.io' },
      { id: 'u2', email: 'mgr@x.io' },
    ]);
    await svc.onBookingCreated({
      bookingId: 'b1', bookingNumber: 'CT-001', tourTitle: 'Горы Дагестана',
      customerName: 'Иван', seats: 2, totalAmount: 45000, customerEmail: 'ivan@x.io',
    });
    const system = state.created.filter((c) => c.channel === 'SYSTEM');
    const email = state.created.filter((c) => c.channel === 'EMAIL');
    expect(system.length).toBe(2); // по одному менеджеру
    expect(email.length).toBe(1);
    expect(email[0]).toMatchObject({ target: 'ivan@x.io', bookingId: 'b1' });
  });

  it('onBookingStatusChanged → правильный event по статусу', async () => {
    const { svc, state } = makeService();
    await svc.onBookingStatusChanged({
      bookingId: 'b1', bookingNumber: 'CT-001', fromStatus: 'NEW', toStatus: 'CONFIRMED',
      customerName: 'Иван', customerEmail: null,
    });
    await svc.onBookingStatusChanged({
      bookingId: 'b1', bookingNumber: 'CT-001', fromStatus: 'CONFIRMED', toStatus: 'CANCELLED',
      customerName: 'Иван', customerEmail: null,
    });
    const events = state.created.map((c) => c.event);
    expect(events).toContain('booking.confirmed');
    expect(events).toContain('booking.cancelled');
  });

  it('retryFailed: dispatch FAILED-записей, считает SENT', async () => {
    const { svc, db } = makeService({});
    (db.notification.findMany as vi.Mock).mockResolvedValueOnce([]);
    expect(await svc.retryFailed(5)).toBe(0);
    expect(db.notification.findMany).toHaveBeenCalled();
  });

  it('list: пагинация ограничена perPage<=100, filters пробрасываются', async () => {
    const { svc, db } = makeService();
    const r = await svc.list({ status: 'FAILED', event: 'booking.paid', page: 2, perPage: 500 });
    expect(r.perPage).toBe(100);
    expect(r.page).toBe(2);
    expect((db.notification.findMany as vi.Mock).mock.calls[0][0].where).toMatchObject({ status: 'FAILED', event: 'booking.paid' });
  });
});

describe('EmailService (§36)', () => {
  it('isValidEmail принимает корректные и отвергает мусор', () => {
    expect(EmailService.isValidEmail('a@b.co')).toBe(true);
    expect(EmailService.isValidEmail('nope')).toBe(false);
    expect(EmailService.isValidEmail('a b@c.d')).toBe(false);
  });

  it('sendEnabled только при флаге + транспорте (§55)', () => {
    const cfg = (env: Record<string, string>) => ({ get: (k: string) => env[k] }) as never;
    expect(new EmailService(cfg({})).sendEnabled).toBe(false);
    expect(new EmailService(cfg({ NOTIFY_EMAIL_ENABLED: 'true' })).sendEnabled).toBe(false);
    expect(new EmailService(cfg({ NOTIFY_EMAIL_ENABLED: 'true', SMTP_URL: 'smtp://x' })).sendEnabled).toBe(true);
  });

  it('без флага — dry-run: sent:false, сети нет', async () => {
    const es = new EmailService({ get: () => undefined } as never);
    const r = await es.send({ to: 'a@b.co', subject: 's', text: 't' });
    expect(r).toEqual({ sent: false, dryRun: true, transport: 'none' });
  });

  it('webhook-транспорт вызывает fetch с полезной нагрузкой', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
    const es = new EmailService({ get: (k: string) => ({ NOTIFY_EMAIL_ENABLED: 'true', EMAIL_WEBHOOK_URL: 'https://h', EMAIL_FROM: 'from@x.io' })[k] } as never);
    const r = await es.send({ to: 'a@b.co', subject: 's', text: 't' }, fetchImpl as never);
    expect(r.sent).toBe(true);
    expect(r.transport).toBe('webhook');
    const [url, init] = (fetchImpl as unknown as vi.Mock).mock.calls[0];
    expect(url).toBe('https://h');
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({ to: 'a@b.co', subject: 's' });
  });

  it('невалидный адрес — INVALID_EMAIL без запросов', async () => {
    const es = new EmailService({ get: (k: string) => ({ NOTIFY_EMAIL_ENABLED: 'true', EMAIL_WEBHOOK_URL: 'https://h' })[k] } as never);
    const f = vi.fn();
    const r = await es.send({ to: 'bad', subject: 's', text: 't' }, f as never);
    expect(r.error).toBe('INVALID_EMAIL');
    expect(f).not.toHaveBeenCalled();
  });
});
