import { describe, it, expect } from 'vitest';
import { TelegramPublicationService } from './telegram-publication.service';

/** Unit-тесты публикации тура в канал (ТЗ §33–34, Phase 10.7) — БД и Bot API мокаются. */

const departureRow = {
  id: 'd1',
  totalSeats: 10,
  bookedSeats: 3,
  startDate: new Date('2026-11-15T08:00:00Z'),
  endDate: new Date('2026-11-18T08:00:00Z'),
  price: 45000,
  tourId: 't1',
  tour: {
    title: 'Тур в Дагестан',
    slug: 'tur-v-dagestan',
    shortDescription: 'Горы и море',
    durationDays: 3,
    destination: { name: 'Дагестан' },
    images: [
      { url: 'https://img/1.jpg', isCover: false },
      { url: 'https://img/cover.jpg', isCover: true },
    ],
  },
  cities: [{ departureCity: { name: 'Ростов-на-Дону' } }, { departureCity: { name: 'Таганрог' } }],
};

function makeMocks(overrides: Record<string, unknown> = {}) {
  const posts: Array<Record<string, unknown>> = [];
  const prisma = {
    isHealthy: () => true,
    departure: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === departureRow.id ? departureRow : null,
    },
    siteSettings: { upsert: async () => ({ telegramPostTemplate: 'Тур: {{tour.title}} | Мест: {{departure.availableSeats}}' }) },
    telegramPost: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const post = { id: `p${posts.length + 1}`, ...data };
        posts.push(post);
        return post;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const p = posts.find((x) => x.id === where.id)!;
        Object.assign(p, data);
        return p;
      },
      findMany: async () => posts,
      findFirst: async ({ where }: { where: { telegramMessageId?: string } }) =>
        posts.find((x) => x.telegramMessageId === where.telegramMessageId) ?? null,
    },
  };
  const config = { get: (k: string) => (k === 'WEB_URL' ? 'https://chirkey.tour' : undefined) };
  const telegram = overrides ?? {};
  return { prisma, config, telegram, posts };
}

function service(mocks: ReturnType<typeof makeMocks>) {
  return new TelegramPublicationService(mocks.prisma as never, mocks.telegram as never, mocks.config as never);
}

describe('TelegramPublicationService (§33)', () => {
  it('buildContext: места/цена/обложка считаются на сервере (§17)', async () => {
    const m = makeMocks();
    const { ctx, photoUrl } = await service(m).buildContext('d1');
    expect(ctx.tour).toMatchObject({ title: 'Тур в Дагестан' });
    expect((ctx.departure as Record<string, unknown>).availableSeats).toBe(7);
    expect((ctx.departure as Record<string, unknown>).price).toBe('45 000 ₽');
    expect(photoUrl).toBe('https://img/cover.jpg'); // обложка, а не первое фото
    expect(ctx.bookingUrl).toBe('https://chirkey.tour/tours/tur-v-dagestan');
  });

  it('publish: успешная отправка → TelegramPost SENT + telegramMessageId', async () => {
    const m = makeMocks({
      sendTourPublication: async () => ({ ok: true, dryRun: false, messageId: 99 }),
      channelId: '@ch',
      sendEnabled: true,
    });
    const res = await service(m).publish('d1', 'user-1');
    expect(res.sent).toBe(true);
    expect(m.posts[0]).toMatchObject({ status: 'SENT', telegramMessageId: '99', tourId: 't1', departureId: 'd1' });
    expect(String(m.posts[0].text)).toBe('Тур: Тур в Дагестан | Мест: 7'); // шаблон из SiteSettings
  });

  it('publish: ошибка отправки → FAILED + error, бросает TELEGRAM_PUBLISH_FAILED, пост сохраняется', async () => {
    const m = makeMocks({
      sendTourPublication: async () => ({ ok: false, dryRun: false, description: 'Bad Request: chat not found' }),
      channelId: '@ch',
      sendEnabled: true,
    });
    await expect(service(m).publish('d1', 'user-1')).rejects.toMatchObject({ code: 'TELEGRAM_PUBLISH_FAILED' });
    expect(m.posts[0].status).toBe('FAILED');
    expect(m.posts[0].error).toContain('chat not found');
  });

  it('publish: dry-run (флаг выключен) → пост остаётся DRAFT, без ошибки (§55)', async () => {
    const m = makeMocks({
      sendTourPublication: async () => ({ ok: false, dryRun: true, description: 'DRY_RUN' }),
      channelId: '@ch',
      sendEnabled: false,
    });
    const res = await service(m).publish('d1', 'user-1');
    expect(res).toMatchObject({ sent: false, dryRun: true });
    expect(m.posts[0].status).toBe('DRAFT');
  });

  it('preview: рендер override-шаблона без записи поста', async () => {
    const m = makeMocks({ channelId: '@ch', sendEnabled: false });
    const p = await service(m).preview('d1', '{{destination.name}} — {{departure.startDate}}');
    expect(p.text).toMatch(/Дагестан — .*2026/);
    expect(m.posts).toHaveLength(0);
  });

  it('несуществующий выезд → DEPARTURE_NOT_FOUND', async () => {
    const m = makeMocks({});
    await expect(service(m).buildContext('nope')).rejects.toMatchObject({ code: 'DEPARTURE_NOT_FOUND' });
  });
});

describe('ingest канала (ТЗ 10.6)', () => {
  const channelUpdate = (over: Record<string, unknown> = {}) => ({
    message: {
      message_id: 501,
      date: 1760000000,
      text: 'Пост из канала: новый тур!',
      forward_from_chat: { id: -1001234567890, username: 'chirkey_tours', type: 'channel' },
      ...over,
    },
  });

  it('forward из канала → TelegramPost(source=CHANNEL_INGEST), дедуп по messageId', async () => {
    const m = makeMocks({ channelId: '@chirkey_tours', sendEnabled: false });
    const s = service(m);
    const res = await s.ingestForwardedFromChannel(channelUpdate());
    expect(res.ingested).toBe(true);
    expect(m.posts[0]).toMatchObject({
      source: 'CHANNEL_INGEST',
      status: 'SENT',
      telegramMessageId: '501',
      channelChatId: '-1001234567890',
      channelUsername: 'chirkey_tours',
      text: 'Пост из канала: новый тур!',
    });
    // повтор того же сообщения → DUPLICATE
    const again = await s.ingestForwardedFromChannel(channelUpdate());
    expect(again).toMatchObject({ ingested: false, reason: 'DUPLICATE' });
    expect(m.posts).toHaveLength(1);
  });

  it('ботский echo (forward_from.is_bot) игнорируется', async () => {
    const m = makeMocks({});
    const res = await service(m).ingestForwardedFromChannel(
      channelUpdate({ forward_from: { is_bot: true, id: 777 } }),
    );
    expect(res).toEqual({ ingested: false, reason: 'BOT_ECHO' });
  });

  it('обычное пользовательское сообщение — не ingest (NOT_FROM_CHANNEL)', async () => {
    const m = makeMocks({});
    const res = await service(m).ingestForwardedFromChannel({ message: { message_id: 1, text: 'привет' } });
    expect(res).toMatchObject({ ingested: false, reason: 'NOT_FROM_CHANNEL' });
    expect(m.posts).toHaveLength(0);
  });

  it('caption вместо text тоже инgestится; пустой текст → NO_TEXT', async () => {
    const m = makeMocks({});
    const res = await service(m).ingestForwardedFromChannel(
      channelUpdate({ text: undefined, caption: 'Подпись к фото', photo: [{ file_id: 'a' }, { file_id: 'big' }] }),
    );
    expect(res.ingested).toBe(true);
    expect(m.posts[0]).toMatchObject({ text: 'Подпись к фото', photoUrl: 'big' });
    const empty = await service(makeMocks({})).ingestForwardedFromChannel(channelUpdate({ text: '', caption: '' }));
    expect(empty).toMatchObject({ ingested: false, reason: 'NO_TEXT' });
  });

  it('templateInfo возвращает дефолтный шаблон и переменные (ТЗ 10.5)', () => {
    const m = makeMocks({});
    const info = service(m).templateInfo();
    expect(info.defaultTemplate).toContain('{{tour.title}}');
    expect(info.variables.map((v) => v.name)).toContain('departure.availableSeats');
  });
});
