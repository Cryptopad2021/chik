/**
 * Сквозной HTTP-прогон контракта авторизации админ-панели (закрытие PHASE 4):
 * login → me → refresh(ротация) → reuse-детект → logout — реальный Nest-стек,
 * in-memory подмены PrismaService/AuditService (в dev нет PostgreSQL).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

const PASSWORD = 'SuperSecret123!';

interface StoredUser {
  id: string; email: string; firstName: string; lastName: string; role: string;
  isActive: boolean; deletedAt: Date | null; passwordHash: string;
  refreshTokenHash: string | null; refreshTokenIssuedAt: Date | null;
}

describe('Auth HTTP contract (admin panel, Phase 4)', () => {
  let app: INestApplication;
  let base: string;
  const users = new Map<string, StoredUser>();
  const auditActions: string[] = [];

  beforeAll(async () => {
    const seed: StoredUser = {
      id: 'u1', email: 'admin@chirkeytour.ru', firstName: 'Root', lastName: 'Admin',
      role: 'SUPER_ADMIN', isActive: true, deletedAt: null,
      passwordHash: await argon2.hash(PASSWORD),
      refreshTokenHash: null, refreshTokenIssuedAt: null,
    };
    users.set(seed.id, seed);

    const fakePrisma = {
      isHealthy: () => true,
      user: {
        findUnique: async ({ where }: { where: { id?: string; email?: string } }) =>
          where.id
            ? users.get(where.id) ?? null
            : [...users.values()].find((u) => u.email === where.email) ?? null,
        update: async ({ where, data }: { where: { id: string }; data: Partial<StoredUser> }) => {
          const u = users.get(where.id);
          if (!u) throw new Error('user not found');
          Object.assign(u, data);
          return u;
        },
      },
    };
    const fakeAudit = {
      log: async (e: { action: string }) => { auditActions.push(e.action); },
      list: async () => [],
    };

    const modRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AuthController],
      providers: [
        AuthService, TokensService, JwtAuthGuard,
        // секреты из env не нужны — фиксированные тестовые
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: PrismaService, useValue: fakePrisma },
        { provide: AuditService, useValue: fakeAudit },
      ],
    }).compile();

    app = modRef.createNestApplication(undefined, { logger: ["error"] });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0);
    const port = (app.getHttpServer().address() as { port: number }).port;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => { await app?.close(); });

  const post = (path: string, opts: { body?: unknown; token?: string; cookie?: string } = {}) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });

  const rtCookie = (res: Response): string | null => {
    const raw = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('rt=')) ?? '';
    const m = raw.match(/rt=([^;]+)/);
    return m ? m[1] : null;
  };

  it('login с неверным паролем → 401', async () => {
    const r = await post('/api/auth/login', { body: { email: 'admin@chirkeytour.ru', password: 'WrongPass123!' } });
    expect(r.status).toBe(401);
  });

  it('DTO-валидация: короткий пароль → 400', async () => {
    const r = await post('/api/auth/login', { body: { email: 'admin@chirkeytour.ru', password: 'short' } });
    expect(r.status).toBe(400);
  });

  it('успешный login: success envelope, accessToken, httpOnly rt-cookie, профиль пользователя', async () => {
    const r = await post('/api/auth/login', { body: { email: 'admin@chirkeytour.ru', password: PASSWORD, remember: true } });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.success).toBe(true);
    expect(typeof j.data.accessToken).toBe('string');
    expect(j.data.user).toMatchObject({ id: 'u1', email: 'admin@chirkeytour.ru', name: 'Root Admin', role: 'SUPER_ADMIN' });
    expect(j.data.refreshToken).toBeUndefined(); // refresh только в cookie
    const setCookies = resHeaders(r);
    expect(setCookies).toMatch(/rt=[^;]+/);
    expect(setCookies).toMatch(/HttpOnly/i);
    expect(setCookies).toMatch(/Path=\/api\/auth/i);
  });

  function resHeaders(r: Response): string { return (r.headers.getSetCookie?.() ?? []).join('; '); }

  it('me: с Bearer → данные, без токена → 401', async () => {
    const r = await post('/api/auth/login', { body: { email: 'admin@chirkeytour.ru', password: PASSWORD } });
    const { data } = await r.json();
    const me = await fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${data.accessToken}` } });
    expect(me.status).toBe(200);
    expect((await me.json()).data.email).toBe('admin@chirkeytour.ru');
    const anon = await fetch(`${base}/api/auth/me`);
    expect(anon.status).toBe(401);
  });

  it('refresh: ротация refresh-cookie и новый access', async () => {
    const r = await post('/api/auth/login', { body: { email: 'admin@chirkeytour.ru', password: PASSWORD, remember: true } });
    const j = await r.json();
    const rt1 = rtCookie(r)!;
    const rf = await post('/api/auth/refresh', { cookie: `rt=${rt1}` });
    expect(rf.status).toBe(200);
    const rj = await rf.json();
    expect(rj.success).toBe(true);
    expect(rj.data.accessToken).toBeTruthy();
    expect(rj.data.accessToken).not.toBe(j.data.accessToken);
    expect(rtCookie(rf)).toBeTruthy();
    expect(rtCookie(rf)).not.toBe(rt1);
  });

  it('reuse украденного refresh → 401 + разрыв всей сессии + аудит', async () => {
    const r = await post('/api/auth/login', { body: { email: 'admin@chirkeytour.ru', password: PASSWORD, remember: true } });
    const rt1 = rtCookie(r)!;
    const rf = await post('/api/auth/refresh', { cookie: `rt=${rt1}` });
    expect(rf.status).toBe(200);
    const rt2 = rtCookie(rf)!;
    // атакующий повторно использует старый rt1
    const attack = await post('/api/auth/refresh', { cookie: `rt=${rt1}` });
    expect(attack.status).toBe(401);
    expect(auditActions).toContain('AUTH_REFRESH_REUSE_DETECTED');
    // легитимный клиент с rt2 тоже разлогинен (сессия аннулирована)
    const victim = await post('/api/auth/refresh', { cookie: `rt=${rt2}` });
    expect(victim.status).toBe(401);
  });

  it('logout: очистка cookie, последующий refresh → 401', async () => {
    const r = await post('/api/auth/login', { body: { email: 'admin@chirkeytour.ru', password: PASSWORD } });
    const j = await r.json();
    const rt = rtCookie(r)!;
    const out = await post('/api/auth/logout', { token: j.data.accessToken, cookie: `rt=${rt}` });
    expect(out.status).toBe(200);
    expect(resHeaders(out)).toMatch(/rt=;/); // clearCookie
    const after = await post('/api/auth/refresh', { cookie: `rt=${rt}` });
    expect(after.status).toBe(401);
  });

  it('аудит AUTH_LOGIN пишется при входах', async () => {
    expect(auditActions.filter((a) => a === 'AUTH_LOGIN').length).toBeGreaterThanOrEqual(5);
  });
});
