'use client';

import { useState } from 'react';
import { type BookingPublicInfo, BOOKING_STATUS_LABELS } from '../lib/api';
import { ru } from '@/content/ru';
import { formatPrice, formatDate } from '../lib/format';

type Ui = 'idle' | 'loading' | 'found' | 'notfound' | 'error';

/** Публичная проверка статуса заявки по номеру (ТЗ §26 /booking/[id]) */
export function BookingStatusLookup({ initialNumber }: { initialNumber?: string }) {
  const [num, setNum] = useState(initialNumber ?? '');
  const [ui, setUi] = useState<Ui>(initialNumber ? 'loading' : 'idle');
  const [data, setData] = useState<BookingPublicInfo | null>(null);

  async function lookup(ev: React.FormEvent) {
    ev.preventDefault();
    const q = num.trim();
    if (q.length < 3) return;
    setUi('loading');
    // next-action не нужен: клиентский fetch к публичному эндпоинту by-number
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100';
      const res = await fetch(`${API_URL}/api/bookings/by-number/${encodeURIComponent(q)}`, { headers: { accept: 'application/json' } });
      if (res.status === 404) { setUi('notfound'); return; }
      if (!res.ok) { setUi('error'); return; }
      const body = await res.json();
      setData((body?.data ?? body) as BookingPublicInfo);
      setUi('found');
    } catch {
      setUi('error');
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <form onSubmit={lookup} className="flex gap-2">
        <label htmlFor="bk-num" className="sr-only">{ru.statusPage.title}</label>
        <input id="bk-num" className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
          placeholder={ru.statusPage.placeholder} value={num} onChange={(e) => setNum(e.target.value)} required minLength={3} />
        <button type="submit" disabled={ui === 'loading'}
          className="rounded-xl bg-emerald-800 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">
          {ui === 'loading' ? ru.statusPage.loading : ru.statusPage.lookup}
        </button>
      </form>

      {ui === 'notfound' ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Заявка с таким номером не найдена. Проверьте номер из письма/подтверждения.</p> : null}
      {ui === 'error' ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{ru.common.errorGeneric}</p> : null}

      {ui === 'found' && data ? (
        <dl className="mt-6 space-y-2 rounded-2xl border border-stone-200 bg-white p-5 text-sm shadow-sm">
          <div className="flex justify-between"><dt className="text-stone-500">Номер</dt><dd className="font-semibold">{data.bookingNumber}</dd></div>
          <div className="flex justify-between"><dt className="text-stone-500">Статус</dt><dd className="font-medium text-emerald-900">{BOOKING_STATUS_LABELS[data.status] ?? data.status}</dd></div>
          {data.departure?.tour ? <div className="flex justify-between"><dt className="text-stone-500">{ru.statusPage.tourLabel}</dt><dd>{data.departure.tour.title}</dd></div> : null}
          {data.departure ? <div className="flex justify-between"><dt className="text-stone-500">{ru.statusPage.dateLabel}</dt><dd>{formatDate(data.departure.startDate)}</dd></div> : null}
          {data.departureCity ? <div className="flex justify-between"><dt className="text-stone-500">{ru.statusPage.cityLabel}</dt><dd>{data.departureCity.name}</dd></div> : null}
          <div className="flex justify-between"><dt className="text-stone-500">{ru.statusPage.guestsLabel(data.adults, data.children10to14, data.childrenUnder10)}</dt><dd>{data.adults + data.children10to14 + data.childrenUnder10}</dd></div>
          <div className="flex justify-between border-t border-stone-200 pt-2"><dt className="text-stone-500">{ru.booking.totalLabel}</dt><dd className="font-semibold">{formatPrice(data.totalAmount, data.currency)}</dd></div>
        </dl>
      ) : null}
    </div>
  );
}
