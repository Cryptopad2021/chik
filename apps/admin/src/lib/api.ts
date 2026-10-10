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
  alt?: string | null;
  createdAt?: string;
}

export async function uploadMedia(file: File): Promise<ApiResult<MediaFile>> {
  const form = new FormData();
  form.append('file', file);
  return postFormData<MediaFile>('media/upload', form);
}

export async function fetchMediaLibrary(page = 1, perPage = 24): Promise<ApiResult<{ items: MediaFile[]; total: number }>> {
  return apiGet<{ items: MediaFile[]; total: number }>(`media?page=${page}&perPage=${perPage}`);
}

export async function setMediaAlt(id: string, alt: string | null): Promise<ApiResult<MediaFile>> {
  return apiPatch<MediaFile>(`media/${id}/alt`, { alt });
}

export async function deleteMedia(id: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`media/${id}`);
}

/* ===== FAQ API (PHASE 9.8) ===== */

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  sortOrder: number;
  isPublished: boolean;
}

export async function fetchFaqAll(): Promise<ApiResult<FaqRow[]>> {
  return apiGet<FaqRow[]>('faq/admin/all');
}

export async function deleteFaq(id: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`faq/${id}`);
}

export async function createFaq(body: { question: string; answer: string; category?: string; sortOrder?: number; isPublished?: boolean }): Promise<ApiResult<FaqRow>> {
  return apiPost<FaqRow>('faq', body);
}

export async function updateFaq(id: string, body: Partial<{ question: string; answer: string; category: string; sortOrder: number; isPublished: boolean }>): Promise<ApiResult<FaqRow>> {
  return apiPatch<FaqRow>(`faq/${id}`, body);
}

/* ===== Reviews API (модерация, PHASE 9.8) ===== */

export type ReviewStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ReviewRow {
  id: string;
  rating: number;
  text: string;
  authorName: string;
  status: ReviewStatusValue;
  createdAt: string;
  tour?: { title: string } | null;
}

export async function fetchReviewsAdmin(status?: ReviewStatusValue): Promise<ApiResult<ReviewRow[]>> {
  const qs = status ? `?status=${status}` : '';
  return apiGet<ReviewRow[]>(`reviews/admin/all${qs}`);
}

export async function moderateReview(id: string, status: 'APPROVED' | 'REJECTED', note?: string): Promise<ApiResult<ReviewRow>> {
  return apiPatch<ReviewRow>(`reviews/${id}/moderate`, { status, note });
}

/* ===== Tours API (PHASE 9.4, ТЗ §20) ===== */

export type TourStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface TourRow {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description?: string;
  destinationId: string;
  destination?: { id: string; name: string; slug: string };
  durationDays: number;
  durationNights: number;
  basePrice: number;
  currency: string;
  status: TourStatus;
  adultPrice?: number | null;
  child10to14Price?: number | null;
  childUnder10Price?: number | null;
  includedText?: string | null;
  notIncludedText?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  days?: { id?: string; dayNumber: number; title: string; description: string; meals?: string | null; overnight?: boolean }[];
  images?: { id?: string; url: string; alt: string; sortOrder?: number; isCover?: boolean }[];
  departures?: { id: string; startDate: string; endDate: string; totalSeats: number; bookedSeats: number; status: string }[];
  _count?: { departures: number; reviews: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function fetchTours(params: { status?: TourStatus | ''; search?: string; page?: number; perPage?: number } = {}): Promise<ApiResult<ListResult<TourRow>>> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.perPage) qs.set('perPage', String(params.perPage));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<ListResult<TourRow>>(`tours${suffix}`);
}

/** Полные данные тура для редактирования — по slug (GET /tours/:slug). */
export async function fetchTour(slugOrId: string): Promise<ApiResult<TourRow>> {
  return apiGet<TourRow>(`tours/${slugOrId}`);
}

export async function createTour(body: Record<string, unknown>): Promise<ApiResult<TourRow>> {
  return apiPost<TourRow>('tours', body);
}

export async function updateTour(id: string, body: Record<string, unknown>): Promise<ApiResult<TourRow>> {
  return apiPatch<TourRow>(`tours/${id}`, body);
}

export async function archiveTour(id: string): Promise<ApiResult<{ id: string; archived: boolean }>> {
  return apiDelete<{ id: string; archived: boolean }>(`tours/${id}`);
}

export async function replaceTourDays(id: string, days: TourRow['days']): Promise<ApiResult<unknown>> {
  return apiPut(`tours/${id}/days`, { days });
}

export async function replaceTourImages(id: string, images: TourRow['images']): Promise<ApiResult<unknown>> {
  return apiPut(`tours/${id}/images`, { images });
}

/* ===== Departures API (PHASE 9.5, ТЗ §21) ===== */

export interface DepartureRow {
  id: string;
  tourId: string;
  tour?: { id: string; slug: string; title: string };
  startDate: string;
  endDate: string;
  totalSeats: number;
  bookedSeats: number;
  availableSeats: number;
  fillPercent: number;
  status: 'OPEN' | 'ALMOST_FULL' | 'FULL' | 'CANCELLED' | 'COMPLETED';
  price: number;
  notes?: string | null;
  cities?: { departureCity?: { id: string; name: string; slug: string }; price?: number | null; notes?: string | null }[];
}

export async function fetchDepartures(params: { tourId?: string; status?: string } = {}): Promise<ApiResult<DepartureRow[]>> {
  const qs = new URLSearchParams();
  if (params.tourId) qs.set('tourId', params.tourId);
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<DepartureRow[]>(`departures${suffix}`);
}

export async function createDeparture(body: Record<string, unknown>): Promise<ApiResult<DepartureRow>> {
  return apiPost<DepartureRow>('departures', body);
}

export async function updateDeparture(id: string, body: Record<string, unknown>): Promise<ApiResult<DepartureRow>> {
  return apiPatch<DepartureRow>(`departures/${id}`, body);
}

export async function closeDepartureSales(id: string, confirm = false): Promise<ApiResult<DepartureRow>> {
  return apiPatch<DepartureRow>(`departures/${id}/close-sales${confirm ? '?confirm=true' : ''}`, {});
}

export async function deleteDeparture(id: string, confirm = false): Promise<ApiResult<{ deleted: boolean }>> {
  return apiDelete<{ deleted: boolean }>(`departures/${id}${confirm ? '?confirm=true' : ''}`);
}

export async function recalculateDepartureSeats(id: string): Promise<ApiResult<DepartureRow & { recalculated?: boolean }>> {
  return apiPost<DepartureRow & { recalculated?: boolean }>(`departures/${id}/recalculate-seats`);
}

/* ===== Bookings API (PHASE 9.6, ТЗ §22) ===== */

export type BookingStatusValue =
  | 'NEW' | 'CONTACTED' | 'PENDING_CONFIRMATION' | 'CONFIRMED'
  | 'PAYMENT_PENDING' | 'PAID' | 'CANCELLED' | 'COMPLETED' | 'REFUNDED';

export interface BookingRow {
  id: string;
  bookingNumber: string;
  status: BookingStatusValue;
  adults: number;
  children10to14: number;
  childrenUnder10: number;
  totalAmount: number | string;
  currency: string;
  comment?: string | null;
  createdAt: string;
  customer?: { id: string; firstName: string; lastName: string; phone: string; email?: string | null };
  departure?: { id: string; startDate: string; tour?: { id: string; title: string; slug: string } | null };
  assignedManager?: { id: string; firstName: string; lastName: string } | null;
}

export async function fetchBookings(params: { status?: string; search?: string; page?: number; perPage?: number } = {}): Promise<ApiResult<ListResult<BookingRow>>> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.perPage) qs.set('perPage', String(params.perPage));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<ListResult<BookingRow>>(`bookings${suffix}`);
}

export async function setBookingStatus(id: string, status: BookingStatusValue, note?: string): Promise<ApiResult<BookingRow>> {
  return apiPatch<BookingRow>(`bookings/${id}/status`, { status, note });
}

export async function addBookingComment(id: string, text: string): Promise<ApiResult<BookingRow>> {
  return apiPatch<BookingRow>(`bookings/${id}/comment`, { text });
}

/* ===== Destinations / Cities API (PHASE 9 CRUD) ===== */

export async function createDestination(body: Record<string, unknown>): Promise<ApiResult<{ id: string }>> {
  return apiPost<{ id: string }>('destinations', body);
}

export async function updateDestination(id: string, body: Record<string, unknown>): Promise<ApiResult<{ id: string }>> {
  return apiPatch<{ id: string }>(`destinations/${id}`, body);
}

export async function deleteDestination(id: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`destinations/${id}`);
}

export interface CityRow {
  id: string;
  slug: string;
  name: string;
  address?: string | null;
  meetingInstructions?: string | null;
  isActive: boolean;
  sortOrder?: number;
}

export async function fetchCities(all?: 'all'): Promise<ApiResult<CityRow[]>> {
  return apiGet<CityRow[]>(`departure-cities${all === 'all' ? '?all=true' : ''}`);
}

export async function createCity(body: Record<string, unknown>): Promise<ApiResult<CityRow>> {
  return apiPost<CityRow>('departure-cities', body);
}

export async function updateCity(id: string, body: Record<string, unknown>): Promise<ApiResult<CityRow>> {
  return apiPatch<CityRow>(`departure-cities/${id}`, body);
}

export async function deleteCity(id: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`departure-cities/${id}`);
}

/* ===== Users API (для назначения менеджера, PHASE 9.6) ===== */

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
}

export async function fetchUsers(): Promise<ApiResult<UserRow[]>> {
  return apiGet<UserRow[]>('users');
}

export async function createUser(body: { email: string; password: string; firstName: string; lastName: string; role: Role }): Promise<ApiResult<UserRow>> {
  return apiPost<UserRow>('users', body);
}

export async function updateUser(id: string, body: Partial<{ firstName: string; lastName: string; role: Role; isActive: boolean; password: string }>): Promise<ApiResult<UserRow>> {
  return apiPatch<UserRow>(`users/${id}`, body);
}

export async function deleteUser(id: string): Promise<ApiResult<{ id: string }>> {
  return apiDelete<{ id: string }>(`users/${id}`);
}

/* ===== Настройки сайта (PHASE 9.9, ТЗ §56–57) ===== */

export interface SiteSettingsRow {
  id: string;
  companyName: string;
  phone: string | null;
  email: string | null;
  telegramUrl: string | null;
  telegramBotUrl: string | null;
  address: string | null;
  socialLinks: unknown;
  logoUrl: string | null;
  faviconUrl: string | null;
  seoDefaultTitle: string | null;
  seoDefaultDescription: string | null;
  heroTitle: string | null;
  heroDescription: string | null;
  advantages: unknown;
  howItWorks: unknown;
  footerText: string | null;
  bookingEnabled: boolean;
  autoConfirmEnabled: boolean;
  notifyNewBookingTelegram: boolean;
  managerTelegramChatIds: unknown;
  telegramChannelId: string | null;
  telegramPostTemplate: string | null;
  featureFlags: unknown;
  updatedAt: string;
}

export async function fetchSiteSettings(): Promise<ApiResult<SiteSettingsRow>> {
  return apiGet<SiteSettingsRow>('settings/admin');
}

export async function updateSiteSettings(body: Partial<SiteSettingsRow>): Promise<ApiResult<SiteSettingsRow>> {
  return apiPatch<SiteSettingsRow>('settings/admin', body);
}

/* ===== Журнал действий (PHASE 9.9, ТЗ §38) ===== */

export interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: Role } | null;
}

export async function fetchAuditLog(limit = 100): Promise<ApiResult<AuditRow[]>> {
  return apiGet<AuditRow[]>(`audit?limit=${limit}`);
}

export async function assignBookingManager(id: string, managerId: string | null): Promise<ApiResult<BookingRow>> {
  return apiPatch<BookingRow>(`bookings/${id}/manager`, { managerId });
}

/* ===== Вспомогательные глаги ===== */

async function apiPut<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>(path, { method: 'PUT', body });
}

async function apiDelete<T>(path: string): Promise<ApiResult<T>> {
  return request<T>(path, { method: 'DELETE' });
}

/* ===== Destinations / Hero-карусель (главная, Phase 5+) ===== */

export interface DestinationRow {
  id: string;
  name: string;
  description?: string | null;
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

/* ============================ DASHBOARD (§19) + CRM (§23) ============================ */

export interface DashboardCards {
  newTotal: number;
  newToday: number;
  contacted: number;
  confirmedActive: number;
  paid: number;
  completed: number;
  cancelled: number;
  revenue: number;
  paidBookings: number;
  tourists: number;
}

export interface DashboardPoint {
  date: string;
  count: number;
  revenue: number;
}

export interface DashboardDeparture {
  id: string;
  startDate: string;
  totalSeats: number;
  bookedSeats: number;
  availableSeats: number;
  status: string;
  tour: { id: string; title: string; slug: string };
}

export interface DashboardBooking {
  id: string;
  bookingNumber: string;
  status: BookingStatusValue;
  totalAmount: string | number;
  currency: string;
  createdAt: string;
  customerId: string;
  customer: { id: string; firstName: string; lastName: string } | null;
  departure: { startDate: string; tour: { title: string } | null } | null;
  customerNote: string | null;
}

export interface DashboardAction {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  user: { firstName: string; lastName: string; role: string } | null;
}

export interface DashboardData {
  periodDays: number;
  cards: DashboardCards;
  chart: DashboardPoint[];
  upcomingDepartures: DashboardDeparture[];
  occupancy: { departures: number; seats: number; booked: number; percent: number };
  recentBookings: DashboardBooking[];
  recentActions: DashboardAction[];
}

export async function fetchDashboard(days = 30): Promise<ApiResult<DashboardData>> {
  return apiGet<DashboardData>(`admin/dashboard?days=${days}`);
}

export interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string;
  email: string | null;
  telegramUsername: string | null;
  note: string | null;
  isDemo: boolean;
  createdAt: string;
  bookingsCount: number;
  reviewsCount: number;
  totalAmount: number;
}

export async function fetchCustomers(
  params: { search?: string; page?: number; perPage?: number } = {},
): Promise<ApiResult<ListResult<CustomerRow>>> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.perPage) qs.set('perPage', String(params.perPage));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<ListResult<CustomerRow>>(`admin/customers${suffix}`);
}

export interface CustomerTrip {
  id: string;
  bookingNumber: string;
  status: BookingStatusValue;
  source: string;
  adults: number;
  children10to14: number;
  childrenUnder10: number;
  totalAmount: string | number;
  currency: string;
  comment: string | null;
  createdAt: string;
  departure: { id: string; startDate: string; endDate: string; tour: { id: string; title: string; slug: string } | null } | null;
  departureCity: { id: string; name: string } | null;
  assignedManager: { id: string; firstName: string; lastName: string } | null;
  history: {
    id: string;
    fromStatus: BookingStatusValue | null;
    toStatus: BookingStatusValue;
    note: string | null;
    createdAt: string;
  }[];
}

export interface CustomerProfile {
  customer: CustomerRow & { telegramUserId: string };
  stats: { bookingsCount: number; totalAmount: number; paidAmount: number; tourists: number };
  bookings: CustomerTrip[];
}

export async function fetchCustomer(id: string): Promise<ApiResult<CustomerProfile>> {
  return apiGet<CustomerProfile>(`admin/customers/${id}`);
}

export async function updateCustomerNote(id: string, note: string | null): Promise<ApiResult<CustomerRow>> {
  return apiPatch<CustomerRow>(`admin/customers/${id}/note`, { note });
}

/* ===== Telegram (PHASE 10.5/10.6) ===== */

export interface TelegramTemplateInfo {
  defaultTemplate: string;
  variables: { name: string; description: string }[];
}

export interface TelegramPostRow {
  id: string;
  text: string;
  photoUrl: string | null;
  telegramMessageId: string | null;
  status: 'DRAFT' | 'SENT' | 'FAILED';
  error: string | null;
  publishedAt: string | null;
  source: string; // PUBLICATION | CHANNEL_INGEST
  channelUsername: string | null;
  createdAt: string;
  tour?: { id: string; title: string; slug: string } | null;
  departure?: unknown;
}

export interface TelegramPreviewResult {
  text: string;
  photoUrl: string | null;
  channel: string | null;
  sendEnabled: boolean;
}

export async function fetchTelegramTemplateInfo(): Promise<ApiResult<TelegramTemplateInfo>> {
  return apiGet<TelegramTemplateInfo>('telegram/template-variables');
}

export async function fetchTelegramPosts(limit = 50): Promise<ApiResult<TelegramPostRow[]>> {
  return apiGet<TelegramPostRow[]>(`telegram/posts?limit=${limit}`);
}

export async function previewTelegramPost(
  departureId: string,
  template: string | null,
): Promise<ApiResult<TelegramPreviewResult>> {
  return apiPost<TelegramPreviewResult>(`telegram/departures/${departureId}/preview`, { template });
}

export async function publishTelegramPost(
  departureId: string,
): Promise<ApiResult<{ sent: boolean; dryRun?: boolean; post: TelegramPostRow }>> {
  return apiPost(`telegram/departures/${departureId}/publish`, {});
}

/** Ручной ingest поста из канала (ТЗ 10.6). */
export async function ingestTelegramPost(body: {
  text: string;
  photoUrl?: string | null;
  channelUsername?: string | null;
  messageId?: string | null;
}): Promise<ApiResult<{ ingested: boolean; postId?: string; reason?: string }>> {
  return apiPost('telegram/ingest', body);
}
