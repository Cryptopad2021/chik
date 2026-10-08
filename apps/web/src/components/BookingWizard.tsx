'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPostWithKey, type BookingCreated, type DepartureInfo, type DepartureCityInfo, type TourFull } from '../lib/api';
import { ru } from '@/content/ru';
import { formatPrice, formatDate, seatsLabel } from '../lib/format';

type UiState = 'idle' | 'submitting' | 'success' | 'error';

/** Пошаговый flow бронирования (ТЗ §15, §69): дата → город → туристы → контакты → подтверждение */
export function BookingWizard({ tour, initialDepartureId }: { tour: TourFull; initialDepartureId?: string }) {
  const [step, setStep] = useState(initialDepartureId ? 1 : 0);
  const steps = [ru.booking.stepDate, ru.booking.stepCity, ru.booking.stepTourists, ru.booking.stepContacts, ru.booking.stepConfirm];

  const openDepartures = useMemo(() => (tour.departures ?? []).filter((d) => d.status === 'OPEN' || d.status === 'ALMOST_FULL'), [tour.departures]);

  const [departureId, setDepartureId] = useState(initialDepartureId ?? '');
  const [cityId, setCityId] = useState('');
  const [adults, setAdults] = useState(1);
  const [children10to14, setChildren10to14] = useState(0);
  const [childrenUnder10, setChildrenUnder10] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  const [ui, setUi] = useState<UiState>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<BookingCreated | null>(null);
  // Идемпотентность против двойного submit (ТЗ §68, §7)
  const [idempotencyKey] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}`));

  const departure = openDepartures.find((d) => d.id === departureId) ?? null;
  const cities: DepartureCityInfo[] = (departure as (DepartureInfo & { cities?: DepartureCityInfo[] }) | null)?.cities ?? [];
  const totalGuests = adults + children10to14 + childrenUnder10;

  const contactErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (firstName.trim().length < 2) e.firstName = 'Укажите имя';
    if (lastName.trim().length < 2) e.lastName = 'Укажите фамилию';
    const p = phone.replace(/[\s()-]/g, '');
    if (!/^\+?\d{10,15}$/.test(p)) e.phone = 'Укажите корректный телефон';
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = 'Некорректный email';
    if (telegram && !/^@?[\w_]{3,}$/.test(telegram)) e.telegram = 'Telegram — например @username';
    return e;
  }, [firstName, lastName, phone, email, telegram]);

  const stepValid = (s: number): boolean => {
    if (s === 0) return !!departureId;
    if (s === 1) return !!cityId;
    if (s === 2) return totalGuests >= 1 && (!departure || totalGuests <= departure.availableSeats);
    if (s === 3) return Object.keys(contactErrors).length === 0;
    return true;
  };

  const priceEstimate = departure
    ? departure.price * adults +
      Math.round(departure.price * 0.8) * children10to14 +
      Math.round(departure.price * 0.6) * childrenUnder10
    : 0;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setTouched(true);
    if (!departure || !cityId || Object.keys(contactErrors).length > 0 || ui === 'submitting') return;
    setUi('submitting');
    setServerError(null);
    const res = await apiPostWithKey<BookingCreated>('bookings', {
      departureId,
      departureCityId: cityId,
      adults,
      children10to14,
      childrenUnder10,
      customer: { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), email: email.trim() || undefined, telegramUsername: telegram.trim() || undefined },
      comment: comment.trim() || undefined,
      source: 'WEBSITE',
    }, idempotencyKey);
    if (res.ok && res.data) {
      setCreated(res.data);
      setUi('success');
    } else {
      setUi('error');
      setServerError(res.error?.message ?? ru.common.errorGeneric);
    }
  }

  if (ui === 'success' && created) {
    return (
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-2xl">✅</p>
        <h2 className="mt-2 font-serif text-xl font-bold text-emerald-950">{ru.booking.successTitle}</h2>
        <p className="mt-2 text-sm text-emerald-900">{ru.booking.successText(created.bookingNumber)}</p>
        <Link href={`/booking/${encodeURIComponent(created.bookingNumber)}`} className="mt-4 inline-block rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">
          {ru.statusPage.title}
        </Link>
      </div>
    );
  }

  const inputCls = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700';

  return (
    <form onSubmit={submit} noValidate aria-label={ru.booking.title}>
      {/* Индикатор шагов */}
      <ol className="mb-6 flex items-center gap-2 text-xs font-medium" aria-label="Шаги бронирования">
        {steps.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${i === step ? 'bg-emerald-800 text-white' : i < step ? 'bg-emerald-200 text-emerald-900' : 'bg-stone-200 text-stone-500'}`} aria-current={i === step ? 'step' : undefined}>{i + 1}</span>
            <span className={i === step ? 'text-emerald-950' : 'text-stone-500'}>{label}</span>
            {i < steps.length - 1 ? <span aria-hidden="true" className="mx-1 hidden text-stone-300 sm:inline">—</span> : null}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-stone-700">{ru.tour.dates}</legend>
          {openDepartures.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">{ru.tour.noDates}</p>
          ) : (
            <div className="space-y-2">
              {openDepartures.map((d) => (
                <label key={d.id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm transition ${departureId === d.id ? 'border-emerald-700 bg-emerald-50' : 'border-stone-200 hover:border-stone-300'}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="departure" className="accent-emerald-800" checked={departureId === d.id} onChange={() => { setDepartureId(d.id); setCityId(''); }} />
                    <span>{formatDate(d.startDate)} — {formatDate(d.endDate)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold text-emerald-950">{formatPrice(d.price, 'RUB')}</span>
                    <span className={`block text-xs ${d.availableSeats <= 3 ? 'text-red-700' : 'text-stone-500'}`}>{seatsLabel(d.availableSeats)}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset disabled={!departure}>
          <legend className="mb-2 text-sm font-medium text-stone-700">{ru.tour.departureCities}</legend>
          {!departure ? <p className="text-sm text-stone-500">Сначала выберите дату.</p> : null}
          <div className="space-y-2">
            {cities.map((c) => (
              <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${cityId === c.id ? 'border-emerald-700 bg-emerald-50' : 'border-stone-200 hover:border-stone-300'}`}>
                <input type="radio" name="city" className="accent-emerald-800" checked={cityId === c.id} onChange={() => setCityId(c.id)} />
                <span>
                  <span className="block font-medium text-stone-900">{c.name}</span>
                  {c.meetingInstructions ? <span className="block text-xs text-stone-500">{c.meetingInstructions}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-stone-700">Количество туристов {departure ? `(свободно мест: ${departure.availableSeats})` : ''}</legend>
          {([
            [ru.booking.adults, adults, setAdults],
            [ru.booking.children10to14, children10to14, setChildren10to14],
            [ru.booking.childrenUnder10, childrenUnder10, setChildrenUnder10],
          ] as const).map(([label, value, setter]) => (
            <div key={label} className="mb-3 flex items-center justify-between">
              <span className="text-sm text-stone-700">{label}</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label={`Уменьшить: ${label}`} className="h-8 w-8 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                  onClick={() => setter(Math.max(label === ru.booking.adults ? 1 : 0, value - 1))} disabled={value <= (label === ru.booking.adults ? 1 : 0)}>−</button>
                <output className="w-8 text-center text-sm font-semibold">{value}</output>
                <button type="button" aria-label={`Увеличить: ${label}`} className="h-8 w-8 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50"
                  onClick={() => setter(value + 1)} disabled={!!departure && totalGuests >= departure.availableSeats}>+</button>
              </div>
            </div>
          ))}
          {departure && totalGuests > departure.availableSeats ? (
            <p role="alert" className="text-xs text-red-700">Свободно только {departure.availableSeats} мест.</p>
          ) : null}
        </fieldset>
      ) : null}

      {step === 3 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-stone-700">{ru.booking.stepContacts}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="bk-first" className="mb-1 block text-xs font-medium text-stone-600">{ru.booking.firstName} *</label>
              <input id="bk-first" className={inputCls} value={firstName} maxLength={100} autoComplete="given-name" onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="bk-last" className="mb-1 block text-xs font-medium text-stone-600">{ru.booking.lastName} *</label>
              <input id="bk-last" className={inputCls} value={lastName} maxLength={100} autoComplete="family-name" onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="bk-phone" className="mb-1 block text-xs font-medium text-stone-600">{ru.booking.phone} *</label>
              <input id="bk-phone" type="tel" className={inputCls} value={phone} maxLength={20} autoComplete="tel" placeholder="+7 900 000-00-00" onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="bk-email" className="mb-1 block text-xs font-medium text-stone-600">{ru.booking.email}</label>
              <input id="bk-email" type="email" className={inputCls} value={email} maxLength={200} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bk-tg" className="mb-1 block text-xs font-medium text-stone-600">{ru.booking.telegram}</label>
              <input id="bk-tg" className={inputCls} value={telegram} maxLength={64} placeholder="@username" onChange={(e) => setTelegram(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bk-comment" className="mb-1 block text-xs font-medium text-stone-600">{ru.booking.comment}</label>
              <textarea id="bk-comment" rows={2} className={inputCls} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          </div>
          {touched && Object.keys(contactErrors).length > 0 ? (
            <ul role="alert" className="mt-2 list-inside list-disc text-xs text-red-700">
              {Object.values(contactErrors).map((m) => <li key={m}>{m}</li>)}
            </ul>
          ) : null}
        </fieldset>
      ) : null}

      {step === 4 ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
          <h3 className="font-semibold text-emerald-950">{ru.booking.stepConfirm}</h3>
          <dl className="mt-2 space-y-1 text-stone-700">
            <div className="flex justify-between"><dt>Тур</dt><dd className="font-medium">{tour.title}</dd></div>
            {departure ? <div className="flex justify-between"><dt>{ru.statusPage.dateLabel}</dt><dd>{formatDate(departure.startDate)}</dd></div> : null}
            {departure ? <div className="flex justify-between"><dt>{ru.statusPage.cityLabel}</dt><dd>{cities.find((c) => c.id === cityId)?.name ?? '—'}</dd></div> : null}
            <div className="flex justify-between"><dt>{ru.statusPage.guestsLabel(adults, children10to14, childrenUnder10)}</dt><dd>{totalGuests}</dd></div>
            <div className="flex justify-between border-t border-stone-200 pt-2"><dt>{ru.booking.totalLabel} (предварительно)</dt><dd className="font-semibold">{formatPrice(priceEstimate, 'RUB')}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-stone-500">{ru.booking.priceNote}</p>
          <p className="mt-1 text-xs text-stone-500">{ru.booking.privacyNote} <a href="/privacy" className="underline">{ru.footer.privacy}</a></p>
        </div>
      ) : null}

      {serverError ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{serverError}</p> : null}

      <div className="mt-5 flex justify-between gap-3">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || ui === 'submitting'}
          className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:invisible">← {ru.booking.back}</button>
        {step < 4 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!stepValid(step)}
            className="rounded-xl bg-emerald-800 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60">{ru.booking.next} →</button>
        ) : (
          <button type="submit" disabled={ui === 'submitting' || !stepValid(3)}
            className="rounded-xl bg-emerald-800 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60">
            {ui === 'submitting' ? ru.booking.submitting : ru.booking.submit}
          </button>
        )}
      </div>
    </form>
  );
}

// Подгрузка данных для шага «город» при выборе выезда без предзагрузки — API уже отдаёт cities в tour.departures
export async function fetchDepartureCities(departureId: string): Promise<DepartureCityInfo[]> {
  const r = await apiGet<{ cities?: DepartureCityInfo[] }>(`departures/${departureId}`, 10);
  return r?.cities ?? [];
}
