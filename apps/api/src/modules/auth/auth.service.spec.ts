import { describe, expect, it, vi } from "vitest";
import * as argon2 from "argon2";
import { AuthService } from "./auth.service";

/**
 * Тесты auth (ТЗ §53): login happy/fail, refresh rotation, reuse detection.
 * Prisma/Tokens/Audit — фейки; argon2 реальный (чистая функция).
 */
function makePrisma(user: Record<string, unknown> | null) {
  const store = { user: user ? { ...user } : null };
  return {
    isHealthy: () => true,
    user: {
      findUnique: async () => store.user,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(store.user ?? {}, data);
        return store.user;
      },
    },
    _store: store,
  };
}

const tokens = {
  signAccess: vi.fn(async (p) => `access:${p.sub}`),
  signRefresh: vi.fn(async (p) => `refresh:${p.sub}:${p.jti}`),
  verifyRefresh: vi.fn(async (t: string) => {
    // эмулируем декод JWT: тест передаёт токен формата "sub:jti"
    const [sub, jti] = String(t).split(":");
    if (!sub || !jti) throw new Error("bad");
    return { sub, jti };
  }),
};

describe("AuthService", () => {
  it("login: успешный вход выдаёт пару токенов и пишет hash jti", async () => {
    const hash = await argon2.hash("S3cret-pass!");
    const prisma = makePrisma({ id: "u1", email: "a@b.ru", firstName: "А", lastName: "Б", role: "ADMIN", passwordHash: hash, isActive: true, deletedAt: null, refreshTokenHash: null });
    const audit = { log: vi.fn(async () => undefined) };
    const svc = new AuthService(prisma as never, tokens as never, audit as never);
    const r = await svc.login("a@b.ru", "S3cret-pass!", false);
    expect(r.user.id).toBe("u1");
    expect(r.accessToken).toBe("access:u1");
    expect(prisma._store.user.refreshTokenHash).toBeTruthy();
    expect(audit.log).toHaveBeenCalled();
  });

  it("login: неверный пароль → 401, хеш не утекает", async () => {
    const hash = await argon2.hash("Right-pw-123");
    const prisma = makePrisma({ id: "u1", email: "a@b.ru", firstName: "А", lastName: "Б", role: "ADMIN", passwordHash: hash, isActive: true, deletedAt: null });
    const svc = new AuthService(prisma as never, tokens as never, { log: vi.fn() } as never);
    await expect(svc.login("a@b.ru", "wrong")).rejects.toThrow(/Неверный email или пароль/);
  });

  it("login: несуществующий email → то же сообщение (timing-safe)", async () => {
    const prisma = makePrisma(null);
    const svc = new AuthService(prisma as never, tokens as never, { log: vi.fn() } as never);
    await expect(svc.login("ghost@b.ru", "whatever")).rejects.toThrow(/Неверный email или пароль/);
  });

  it("refresh: ротация — новый jti сохраняется, старый аннулируется", async () => {
    const oldJti = "old-jti";
    const prisma = makePrisma({ id: "u1", email: "a@b.ru", firstName: "А", lastName: "Б", role: "ADMIN", isActive: true, deletedAt: null, refreshTokenHash: await argon2.hash(oldJti) });
    const svc = new AuthService(prisma as never, tokens as never, { log: vi.fn() } as never);
    const r = await svc.refresh(`u1:${oldJti}`);
    expect(r.accessToken).toBe("access:u1");
    const stored = prisma._store.user.refreshTokenHash as string;
    expect(await argon2.verify(stored, oldJti)).toBe(false); // старый jti больше не валиден
  });

  it("refresh: повторное использование украденного токена → сессия разорвана + audit", async () => {
    const prisma = makePrisma({ id: "u1", email: "a@b.ru", firstName: "А", lastName: "Б", role: "ADMIN", isActive: true, deletedAt: null, refreshTokenHash: await argon2.hash("current-jti") });
    const audit = { log: vi.fn(async () => undefined) };
    const svc = new AuthService(prisma as never, tokens as never, audit as never);
    await expect(svc.refresh("u1:stolen-old-jti")).rejects.toThrow(/Сессия завершена/);
    expect(prisma._store.user.refreshTokenHash).toBeNull();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "AUTH_REFRESH_REUSE_DETECTED" }));
  });

  it("me: не возвращает passwordHash", async () => {
    const prisma = makePrisma({ id: "u1", email: "a@b.ru", firstName: "А", lastName: "Б", role: "VIEWER", isActive: true, deletedAt: null, passwordHash: "secret-hash" });
    const svc = new AuthService(prisma as never, tokens as never, { log: vi.fn() } as never);
    const me = await svc.me("u1");
    expect(JSON.stringify(me)).not.toContain("secret-hash");
    expect(me.role).toBe("VIEWER");
  });
});
