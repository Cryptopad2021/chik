'use client';

import { useMemo, useState } from 'react';
import { apiPost } from '../lib/api';
import { ru } from '@/content/ru';

type UiState = 'idle' | 'submitting' | 'success' | 'error';

/** Форма «Задать вопрос» (ТЗ §26 /contacts → ContactRequest на backend) */
export function ContactForm() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const [ui, setUi] = useState<UiState>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Укажите имя';
    const c = contact.trim();
    if (!c) e.contact = 'Укажите телефон, email или Telegram';
    else if (!/^[+\d][\d\s()-]{7,}$/.test(c) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) && !/^@[\w_]{3,}$/.test(c))
      e.contact = 'Похоже, контакт указан неверно: телефон, email или @username';
    if (message.trim().length < 5) e.message = 'Напишите вопрос (минимум 5 символов)';
    return e;
  }, [name, contact, message]);

  const canSubmit = Object.keys(errors).length === 0 && ui !== 'submitting';

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setUi('submitting');
    setServerError(null);
    const res = await apiPost<{ id: string }>('contact-requests', {
      name: name.trim(),
      contact: contact.trim(),
      message: message.trim(),
    });
    if (res.ok) {
      setUi('success');
      setName(''); setContact(''); setMessage(''); setTouched(false);
    } else {
      setUi('error');
      setServerError(res.error?.message ?? ru.common.errorGeneric);
    }
  }

  const inputCls = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700';

  if (ui === 'success') {
    return <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{ru.contacts.formSuccess}</p>;
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-4">
      <div>
        <label htmlFor="ct-name" className="mb-1 block text-sm font-medium text-stone-700">{ru.reviews.formName}</label>
        <input id="ct-name" className={inputCls} value={name} maxLength={200} autoComplete="name"
          onChange={(e) => setName(e.target.value)} required aria-invalid={touched && !!errors.name} />
        {touched && errors.name ? <p className="mt-1 text-xs text-red-700">{errors.name}</p> : null}
      </div>
      <div>
        <label htmlFor="ct-contact" className="mb-1 block text-sm font-medium text-stone-700">Телефон / email / Telegram</label>
        <input id="ct-contact" className={inputCls} value={contact} maxLength={200}
          onChange={(e) => setContact(e.target.value)} required aria-invalid={touched && !!errors.contact} />
        {touched && errors.contact ? <p className="mt-1 text-xs text-red-700">{errors.contact}</p> : null}
      </div>
      <div>
        <label htmlFor="ct-msg" className="mb-1 block text-sm font-medium text-stone-700">{ru.contacts.formMessage}</label>
        <textarea id="ct-msg" rows={4} maxLength={4000} className={inputCls} value={message}
          onChange={(e) => setMessage(e.target.value)} required aria-invalid={touched && !!errors.message} />
        {touched && errors.message ? <p className="mt-1 text-xs text-red-700">{errors.message}</p> : null}
      </div>

      {serverError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{serverError}</p> : null}

      <button type="submit" disabled={!canSubmit}
        className="inline-flex items-center justify-center rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
        {ui === 'submitting' ? ru.booking.submitting : ru.contacts.formSubmit}
      </button>
      <p className="text-xs text-stone-500">{ru.booking.privacyNote} <a href="/privacy" className="underline">{ru.footer.privacy}</a></p>
    </form>
  );
}
