/**
 * Клиент API (ТЗ §17: цены/данные только с backend).
 * Server-side fetch с коротким ISR-кэшем; при недоступности API — null → empty state (ТЗ §67),
 * никаких фиктивных данных (ТЗ §76).
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100';

export async function apiGet<T>(path: string, revalidate = 30): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api/${path}`, {
      next: { revalidate },
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.warn('[apiGet] non-ok', path, res.status); return null; }
    const body = (await res.json()) as { success?: boolean; data?: T } | T;
    // API отдаёт либо голый объект, либо обёртку { success, data } — поддержать оба
    if (body && typeof body === 'object' && 'success' in body && (body as { success?: boolean }).success === true) {
      return (body as { data: T }).data;
    }
    return body as T;
  } catch (e) {
    console.warn('[apiGet] error', path, String(e));
    return null;
  }
}

/** POST из браузера (бронирование, отзыв) — типизированный ответ с обработкой ошибок (ТЗ §45) */
export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: { code: string; message: string };
}

export async function apiPost<T>(path: string, payload: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}/api/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => null);
    if (res.ok) {
      const data = body && 'data' in (body as object) ? (body as { data: T }).data : (body as T);
      return { ok: true, status: res.status, data };
    }
    const err =
      body && typeof body === 'object' && 'error' in body
        ? (body as { error: { code: string; message: string } }).error
        : { code: 'UNKNOWN', message: 'Не удалось выполнить запрос. Попробуйте ещё раз.' };
    return { ok: false, status: res.status, error: err };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.' } };
  }
}

/* ===== Типы ответов API (совпадают с Prisma-моделями, поля которые использует web) ===== */

export interface TourSummary {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  destinationId: string;
  destination?: { id: string; slug: string; name: string } | null;
  durationDays: number | null;
  durationNights: number | null;
  basePrice: number;
  currency: string;
  coverImage?: string | null;
  nextDeparture?: { id: string; startDate: string; endDate: string; availableSeats: number; price: number } | null;
}

export interface TourDay {
  id: string;
  dayNumber: number;
  title: string;
  description: string | null;
  meals: string | null;
  overnight: boolean;
}

export interface TourImage {
  id: string;
  url: string;
  alt: string | null;
  isCover: boolean;
}

export interface DepartureInfo {
  id: string;
  startDate: string;
  endDate: string;
  totalSeats: number;
  bookedSeats: number;
  availableSeats: number;
  status: string;
  price: number;
  cities?: { id: string; name: string; slug: string }[];
}

export interface TourFull extends TourSummary {
  description: string | null;
  includedText: string | null;
  notIncludedText: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  days: TourDay[];
  images: TourImage[];
  departures: DepartureInfo[];
  reviews?: ReviewInfo[];
}

export interface DestinationInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  toursCount?: number;
}

export interface DepartureCityInfo {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  meetingInstructions: string | null;
}

export interface ReviewInfo {
  id: string;
  rating: number;
  text: string;
  createdAt: string;
  customer?: { firstName: string; lastName: string | null } | null;
  tour?: { slug: string; title: string } | null;
}

export interface FaqInfo {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

export interface SiteSettingsInfo {
  companyName: string;
  phone: string | null;
  email: string | null;
  telegramUrl: string | null;
  telegramBotUrl: string | null;
  address: string | null;
  socialLinks: Record<string, string> | null;
  logoUrl: string | null;
  seoDefaultTitle: string | null;
  seoDefaultDescription: string | null;
  heroTitle: string | null;
  heroDescription: string | null;
  advantages: unknown;
  howItWorks: unknown;
  footerText: string | null;
  bookingEnabled: boolean;
}

export interface BookingCreated {
  bookingNumber: string;
  id: string;
  status: string;
  totalAmount: number;
  currency: string;
}

export interface BookingPublicInfo {
  bookingNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  adults: number;
  children10to14: number;
  childrenUnder10: number;
  createdAt: string;
  departure?: { startDate: string; tour?: { title: string; slug: string } | null } | null;
  departureCity?: { name: string } | null;
}

/** Статусы бронирований — человекочитаемые подписи (ТЗ §14) */
export const BOOKING_STATUS_LABELS: Record<string, string> = {
  NEW: 'Новая заявка',
  CONTACTED: 'С вами связались',
  PENDING_CONFIRMATION: 'Ожидает подтверждения',
  CONFIRMED: 'Подтверждена',
  PAYMENT_PENDING: 'Ожидает оплаты',
  PAID: 'Оплачена',
  CANCELLED: 'Отменена',
  COMPLETED: 'Завершена',
  REFUNDED: 'Возврат оформлен',
};

export async function apiPostWithKey<T>(path: string, payload: unknown, idempotencyKey: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}/api/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'idempotency-key': idempotencyKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => null);
    if (res.ok) {
      const data = body && 'data' in (body as object) ? (body as { data: T }).data : (body as T);
      return { ok: true, status: res.status, data };
    }
    const err =
      body && typeof body === 'object' && 'error' in body
        ? (body as { error: { code: string; message: string } }).error
        : { code: 'UNKNOWN', message: 'Не удалось выполнить запрос.' };
    return { ok: false, status: res.status, error: err };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Нет связи с сервером. Попробуйте ещё раз.' } };
  }
}
