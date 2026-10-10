import { describe, it, expect, vi } from 'vitest';
import { TelegramController } from './telegram.controller';
import { AppException } from '../../common/app-exception';

/** Webhook-контракт (ТЗ 10.2/10.7): секрет обязателен, логика бота — асинхронно. */

function makeController(secretOk: boolean) {
  const handleUpdate = vi.fn(async () => undefined);
  const bot = { handleUpdate } as never;
  const telegram = { verifyWebhookSecret: () => secretOk } as never;
  const ctrl = new TelegramController(bot, {} as never, telegram, { log: vi.fn() } as never);
  return { ctrl, handleUpdate };
}

describe('POST /api/telegram/webhook', () => {
  it('неверный секрет → 403, апдейт не обрабатывается', async () => {
    const { ctrl, handleUpdate } = makeController(false);
    await expect(ctrl.webhook('bad', { message: {} })).rejects.toBeInstanceOf(AppException);
    expect(handleUpdate).not.toHaveBeenCalled();
  });

  it('верный секрет → быстрый 200 без ожидания логики бота', async () => {
    const { ctrl, handleUpdate } = makeController(true);
    const res = await ctrl.webhook('good', { message: { chat: { id: 1 }, text: '/start' } });
    expect(res).toEqual({ received: true });
    // handleUpdate вызывается fire-and-forget — даём микрозадаче отработать
    await new Promise((r) => setImmediate(r));
    expect(handleUpdate).toHaveBeenCalledWith({ message: { chat: { id: 1 }, text: '/start' } });
  });
});
