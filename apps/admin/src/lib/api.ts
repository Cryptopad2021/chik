/**
 * API-клиент админ-панели (ТЗ §2, §39, §45).
 *
 * Схема аутентификации (зеркалит backend Phase 4):
 *  - refresh-токен — httpOnly cookie `rt` (path=/api/auth), недоступен JS;
 *  - access-токен (15m) — в памяти клиента; при перезагрузке страницы
 *    восстанавливается через POST /auth/refresh (ротация refresh на сервере);
 *  - logout очищает cookie через POST /auth/logout.
 *
 * Все запросы идут с `credentials: 'include'`, чтобы browser отправлял cookie
 * на кросс-порт (admin :3002 → api :3001, CORS allow-list + credentials на API).
 */

import type { Role } from './permissions';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface LoginResponse {
  user: SessionUser;
  accessToken: string;
  tokenType: 'Bearer';
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: { code: string; message: string };
}

/** Память модуля: access-токен живёт только здесь (не localStorage — ТЗ §39). */
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function authHeaders(): Record<string, string> {
  return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
}

async function parseError(res: Response): Promise<{ code: string; message: string }> {
  const body = await res.json().catch(() => null);
  if (body && typeof body === 'object' && 'error' in body) {
    const e = (body as { error?: { code?: string; message?: string } }).error;
    if (e?.message) {
      return { code: e.code ?? 'UNKNOWN', message: e.message };
    }
  }
  return { code: 'UNKNOWN', message: 'Не удалось выполнить запрос. Попробуйте ещё раз.' };
}

/**
 * Один refresh на все параллельные 401 (single-flight): несколько запросов,
 * упёршихся в истёкший access, ждут одну общую попытку продления.
 */
async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return false;
        const body = (await res.json()) as {
          success?: boolean;
          data?: LoginResponse;
        };
        if (body.success && body.data?.accessToken) {
          accessToken = body.data.accessToken;
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        // сброс после settle, чтобы следующий цикл мог обновиться заново
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; retryOn401?: boolean } = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body, retryOn401 = true } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/${path}`, {
      method,
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...authHeaders(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
      },
    };
  }

  // Access истёк → одна попытка refresh + повтор запроса (ТЗ §39 ротация)
  if (res.status === 401 && retryOn401) {
    if (await tryRefresh()) {
      return request<T>(path, { ...init, retryOn401: false });
    }
  }

  if (res.ok) {
    const json = await res.json().catch(() => null);
    const data =
      json && typeof json === 'object' && 'data' in json
        ? (json as { data: T }).data
        : (json as T);
    return { ok: true, status: res.status, data };
  }
  return { ok: false, status: res.status, error: await parseError(res) };
}

export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body });
export const apiPatch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body });

/** POST multipart (загрузка файла в медиа-библиотеку). */
async function postFormData<T>(
  path: string,
  form: FormData,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { accept: 'application/json', ...authHeaders() },
      body: form,
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: { code: 'NETWORK_ERROR', message: 'Нет связи с сервером.' },
    };
  }
  if (res.status === 401 && (await tryRefresh())) {
    return postFormData<T>(path, form);
  }
  if (res.ok) {
    const json = await res.json().catch(() => null);
    const data =
      json && typeof json === 'object' && 'data' in json
        ? (json as { data: T }).data
        : (json as T);
    return { ok: true, status: res.status, data };
  }
  return { ok: false, status: res.status, error: await parseError(res) };
}

/* ===== Media API (Phase 5, ТЗ §41) ===== */

export interface MediaFile {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
}

export async function uploadMedia(file: File): Promise<ApiResult<MediaFile>> {
  const form = new FormData();
  form.append('file', file);
  return postFormData<MediaFile>('media/upload', form);
}

/* ===== Destinations / Hero-карусель (главная, Phase 5+) ===== */

export interface DestinationRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  _count?: { tours: number };
  heroSlideImageUrl?: string | null;
  heroSlideTitle?: string | null;
  heroSlideText?: string | null;
  showInHero?: boolean;
  heroSortOrder?: number;
}

export interface HeroSettings {
  title: string;
  text: string;
  imageUrl: string | null;
  showInHero: boolean;
  heroSortOrder: number;
  tourSlug: string | null; // клик слайда ведёт на этот тур (первый опубликованный)
}

export async function fetchDestinations(): Promise<ApiResult<DestinationRow[]>> {
  return apiGet<DestinationRow[]>('destinations');
}

export async function fetchHeroSettings(id: string): Promise<ApiResult<HeroSettings>> {
  return apiGet<HeroSettings>(`destinations/${id}/hero`);
}

export async function updateHeroSettings(
  id: string,
  patch: Partial<{
    title: string | null;
    text: string | null;
    imageUrl: string | null;
    showInHero: boolean;
    heroSortOrder: number;
  }>,
): Promise<ApiResult<{ id: string }>> {
  return apiPatch<{ id: string }>(`destinations/${id}/hero`, patch);
}

/* ===== Auth API (Phase 4) ===== */

export async function login(
  email: string,
  password: string,
  remember: boolean,
): Promise<ApiResult<SessionUser>> {
  const res = await request<LoginResponse>('auth/login', {
    method: 'POST',
    body: { email, password, remember },
    retryOn401: false,
  });
  if (res.ok && res.data?.accessToken) {
    accessToken = res.data.accessToken;
    return { ok: true, status: res.status, data: res.data.user };
  }
  return { ok: false, status: res.status, error: res.error };
}

export async function fetchMe(): Promise<ApiResult<SessionUser>> {
  return request<SessionUser>('auth/me');
}

/** Пробует восстановить сессию из httpOnly refresh-cookie. */
export async function restoreSession(): Promise<SessionUser | null> {
  if (await tryRefresh()) {
    const me = await request<SessionUser>('auth/me', { retryOn401: false });
    return me.ok ? (me.data ?? null) : null;
  }
  accessToken = null;
  return null;
}

export async function logout(): Promise<void> {
  await request('auth/logout', { method: 'POST', retryOn401: false });
  accessToken = null;
}
