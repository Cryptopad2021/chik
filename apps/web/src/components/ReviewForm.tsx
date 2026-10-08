'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, type TourSummary } from '../lib/api';
import { ru } from '@/content/ru';

type UiState = 'idle' | 'submitting' | 'success' | 'error';

const RATING_LABELS = ['', 'Ужасно', 'Плохо', 'Нормально', 'Хорошо', 'Отлично'];

/** Форма оставления отзыва (ТЗ §24): client-side validation + loading/success/error states */
export function ReviewForm() {
  const [tours, setTours] = useState<TourSummary[]>([]);
  const [name, setName] = useState('');
  const [tourId, setTourId] = useState('');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [ui, setUi] = useState<UiState>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void apiGet<{ items: TourSummary[] }>('tours?perPage=50', 60).then((r) => {
      if (alive) setTours(r?.items ?? []);
    });
    return () => { alive = false; };
  }, []);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Укажите имя (минимум 2 символа)';
    if (!tourId) e.tourId = 'Выберите тур';
    if (rating < 1 || rating > 5) e.rating = 'Поставьте оценку от 1 до 5';
    if (text.trim().length < 10) e.text = 'Текст отзыва — минимум 10 символов';
    return e;
  }, [name, tourId, rating, text]);

  const canSubmit = Object.keys(errors).length === 0 && ui !== 'submitting';

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setUi('submitting');
    setServerError(null);
    const res = await apiPost<{ id: string }>('reviews', {
      tourId,
      rating,
      text: text.trim(),
      authorName: name.trim(),
    });
    if (res.ok) {
      setUi('success');
      setName(''); setTourId(''); setRating(0); setText(''); setTouched(false);
    } else {
      setUi('error');
      setServerError(res.error?.message ?? ru.common.errorGeneric);
    }
  }

  const inputCls = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700';

  if (ui === 'success') {
    return (
      <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        {ru.reviews.formSuccess}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-4">
      <div>
        <label htmlFor="rv-name" className="mb-1 block text-sm font-medium text-stone-700">{ru.reviews.formName}</label>
        <input id="rv-name" className={inputCls} value={name} maxLength={200} autoComplete="name"
          onChange={(e) => setName(e.target.value)} required aria-invalid={touched && !!errors.name} />
        {touched && errors.name ? <p className="mt-1 text-xs text-red-700">{errors.name}</p> : null}
      </div>

      <div>
        <label htmlFor="rv-tour" className="mb-1 block text-sm font-medium text-stone-700">{ru.reviews.formTour}</label>
        <select id="rv-tour" className={inputCls} value={tourId} onChange={(e) => setTourId(e.target.value)} required
          aria-invalid={touched && !!errors.tourId}>
          <option value="">—</option>
          {tours.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        {touched && errors.tourId ? <p className="mt-1 text-xs text-red-700">{errors.tourId}</p> : null}
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-stone-700">{ru.reviews.formRating}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} aria-pressed={rating === n} aria-label={`Оценка ${n} из 5 — ${RATING_LABELS[n]}`}
              className={`rounded-md px-2 py-1 text-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${rating >= n ? 'text-amber-500' : 'text-stone-300 hover:text-amber-300'}`}
              onClick={() => setRating(n)}>★</button>
          ))}
        </div>
        {touched && errors.rating ? <p className="mt-1 text-xs text-red-700">{errors.rating}</p> : null}
      </fieldset>

      <div>
        <label htmlFor="rv-text" className="mb-1 block text-sm font-medium text-stone-700">{ru.reviews.formText}</label>
        <textarea id="rv-text" rows={4} maxLength={4000} className={inputCls} value={text}
          onChange={(e) => setText(e.target.value)} required aria-invalid={touched && !!errors.text} />
        {touched && errors.text ? <p className="mt-1 text-xs text-red-700">{errors.text}</p> : null}
      </div>

      {serverError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{serverError}</p> : null}

      <button type="submit" disabled={!canSubmit}
        className="inline-flex items-center justify-center rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
        {ui === 'submitting' ? ru.booking.submitting : ru.reviews.formSubmit}
      </button>
      <p className="text-xs text-stone-500">{ru.booking.privacyNote} <a href="/privacy" className="underline">{ru.footer.privacy}</a></p>
    </form>
  );
}
