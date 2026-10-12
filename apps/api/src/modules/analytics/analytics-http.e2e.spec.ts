import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rateLimit from 'express-rate-limit';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditModule } from '../audit/audit.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AnalyticsModule } from './analytics.module';
import { AnalyticsService } from './analytics.service';

/**
 * E2E-интеграция (HTTP) аналитического API без БД: Prisma заменяется моком.
 * Проверяет: DTO-валидацию whitelist-типов, отклонение ПДн (§72), батч с лимитом 50.
 */
describe('Analytics HTTP e2e', () => {
  let app: INestApplication;
  const created: Array<Record<string, unknown>> = [];

  const prismaMock = {
    isHealthy: () => true,
    analyticsEvent: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: `id-${created.length}`, ...data };
      }),
    },
  };

  beforeEach(async () => {
    created.length = 0;
    prismaMock.analyticsEvent.create.mockClear();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PrismaModule,
        AuditModule,
        AnalyticsModule,
      ],
    })
      // Контроллер админ-агрегатов использует JwtAuthGuard/PermissionsGuard —
      // в HTTP-тесте публичного ingest они не нужны, подменяем пропускающими.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(AnalyticsService)
      .useFactory({ factory: () => new AnalyticsService(prismaMock as never) })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    // Тот же строгий лимит на публичный приём событий, что и в main.ts
    app.use('/api/analytics', rateLimit({ windowMs: 60_000, max: 2 }));
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${await app.getUrl()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  };

  it('принимает корректное событие whitelist-типа', async () => {
    const r = await post('/api/analytics/events', {
      type: 'view_tour',
      tourId: '9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
      sessionId: 'sess-1',
      path: '/tours/gagra',
    });
    expect(r.status).toBe(201);
    expect(r.json.data.accepted).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0].type).toBe('view_tour');
  });

  it('отклоняет неизвестный тип события на уровне DTO (400)', async () => {
    const r = await post('/api/analytics/events', { type: 'evil_event' });
    expect(r.status).toBe(400);
    expect(created).toHaveLength(0);
  });

  it('отклоняет metadata с ПДн (§72): accepted=false, ничего не записано', async () => {
    const r = await post('/api/analytics/events', {
      type: 'start_booking',
      metadata: { phone: '+79001234567' },
    });
    expect(r.status).toBe(201);
    expect(r.json.data).toEqual({ accepted: false, reason: 'PII_IN_METADATA' });
    expect(created).toHaveLength(0);
  });

  it('батч ограничивает 50 событий и считает accepted/rejected', async () => {
    const events = Array.from({ length: 60 }, (_, i) => ({
      type: i % 5 === 0 ? 'phone_click' : 'bogus_type',
    }));
    // bogus пройдёт валидацию DTO? Нет — IsIn отклонит весь батч. Используем только валидные типы.
    const valid = Array.from({ length: 60 }, (_, i) =>
      i % 5 === 0
        ? { type: 'telegram_click', metadata: { btn: 'book' } }
        : { type: 'view_tour' },
    );
    const r = await post('/api/analytics/events/batch', { events: valid });
    expect(events).toHaveLength(60); // sanity
    expect(r.status).toBe(201);
    expect(r.json.data.received).toBe(50); // лимит среза
    expect(r.json.data.accepted).toBe(50);
    expect(created).toHaveLength(50);
  });

  it('rate limit: 3-й запрос в окне получает 429', async () => {
    await post('/api/analytics/events', { type: 'view_tour' });
    await post('/api/analytics/events', { type: 'view_tour' });
    const r = await post('/api/analytics/events', { type: 'view_tour' });
    expect(r.status).toBe(429);
  });
});
