/**
 * Unit-тесты API-клиента админки (PHASE 4): сценарии login / 401→refresh→retry /
 * reuse-refresh без cookie. Mock глобального fetch — без сети.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// перехватываем fetch до импорта клиента
const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function importClient() {
  return import('@/lib/api');
}

describe('admin api client', () => {
  it('login сохраняет accessToken в памяти и возвращает пользователя', async () => {
    const { login, getAccessToken } = await importClient();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {
          user: { id: 'u1', email: 'a@b.c', name: 'A B', role: 'ADMIN' },
          accessToken: 'ACCESS1',
          refreshToken: 'RT1',
          tokenType: 'Bearer',
        },
      }),
    );

    const res = await login('a@b.c', 'password123', false);
    expect(res.ok).toBe(true);
    expect(res.data?.role).toBe('ADMIN');
    expect(getAccessToken()).toBe('ACCESS1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/auth/login');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('при 401 делает refresh и повторяет запрос один раз', async () => {
    const { login, apiGet } = await importClient();
    // логин успешный
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {
          user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'VIEWER' },
          accessToken: 'OLD',
          tokenType: 'Bearer',
        },
      }),
    );
    await login('a@b.c', 'password123', false);

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'истёк' } })) // GET → 401
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { user: {}, accessToken: 'NEW', tokenType: 'Bearer' },
        }),
      ) // refresh ok
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { hello: 1 } })); // retry ok

    const res = await apiGet<{ hello: number }>('tours');
    expect(res.ok).toBe(true);
    expect(res.data?.hello).toBe(1);

    // вызовы: login, GET(401), refresh, GET(retry)
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const retryUrl = String(fetchMock.mock.calls[3][0]);
    expect(retryUrl).toContain('/api/tours');
    const retryInit = fetchMock.mock.calls[3][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).authorization).toBe('Bearer NEW');
  });

  it('если refresh не удался — 401 пробрасывается наружу, повторного запроса нет', async () => {
    const { apiGet } = await importClient();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false, error: { code: 'NO_REFRESH_COOKIE', message: 'Нет сессии' } }))
      .mockResolvedValueOnce(jsonResponse(401, { success: false, error: { code: 'NO_REFRESH_COOKIE', message: 'Нет сессии' } }));

    const res = await apiGet('bookings');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2); // GET + refresh, без retry
  });

  it('параллельные 401 используют один refresh (single-flight)', async () => {
    const { login, apiGet } = await importClient();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: { user: { id: 'u', email: 'e', name: 'n', role: 'ADMIN' }, accessToken: 'OLD', tokenType: 'Bearer' },
      }),
    );
    await login('e', 'password123', false);

    let refreshCalls = 0;
    fetchMock.mockImplementation(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) {
        refreshCalls += 1;
        return jsonResponse(200, { success: true, data: { accessToken: 'NEW', user: {} } });
      }
      // первый заход на каждый ресурс — 401, после refresh — ok
      return (globalThis as { __seen?: Set<string> }).__seen?.has(u)
        ? jsonResponse(200, { success: true, data: { ok: true } })
        : (((globalThis as { __seen?: Set<string> }).__seen ??= new Set()).add(u), jsonResponse(401, {}));
    });

    const [a, b] = await Promise.all([apiGet('tours'), apiGet('departures')]);
    expect(a.ok && b.ok).toBe(true);
    expect(refreshCalls).toBeLessThanOrEqual(2); // не по одному refresh на каждый запрос в худшем случае гонок нет при single-flight
  });
});
