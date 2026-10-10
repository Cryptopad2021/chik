'use client';

/**
 * Профиль клиента (PHASE 9.7, ТЗ §23): контакты, суммы, поездки (заявки),
 * история статусов по каждой заявке, редактируемый комментарий менеджера.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import {
  fetchCustomer,
  updateCustomerNote,
  type CustomerProfile,
  type BookingStatusValue,
} from '@/lib/api';
import { Button, EmptyState, ErrorBanner, Field, SkeletonRows, SuccessBanner, TextArea } from '@/components/ui';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новая',
  CONTACTED: 'Контакт',
  PENDING_CONFIRMATION: 'Ждёт подтверждения',
  CONFIRMED: 'Подтверждена',
  PAYMENT_PENDING: 'Ожидает оплаты',
  PAID: 'Оплачена',
  CANCELLED: 'Отменена',
  COMPLETED: 'Завершена',
  REFUNDED: 'Возврат',
};

const money = (n: number | string) => Number(n).toLocaleString('ru-RU') + ' ₽';
const dstr = (s: string) => new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

export default function CustomerPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [data, setData] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteOk, setNoteOk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchCustomer(id);
    if (res.ok && res.data) {
      setData(res.data);
      setNote(res.data.customer.note ?? '');
    } else {
      setError(res.error?.message ?? 'Клиент не найден');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const saveNote = async () => {
    setNoteSaving(true);
    setNoteOk(false);
    const res = await updateCustomerNote(id, note.trim() || null);
    if (res.ok) {
      setNoteOk(true);
      setData((d) => (d ? { ...d, customer: { ...d.customer, note: res.data?.note ?? null } } : d));
    } else {
      setError(res.error?.message ?? 'Не удалось сохранить комментарий');
    }
    setNoteSaving(false);
  };

  return (
    <AdminShell title="Профиль клиента">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {loading || !data ? (
        <SkeletonRows rows={6} cols={3} />
      ) : (
        <>
          <div className="mb-4">
            <Link href="/customers" className="text-sm text-brand-700 hover:underline">
              ← Все клиенты
            </Link>
          </div>

          {/* Контакты + агрегаты */}
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-xl font-bold text-neutral-900">
              {data.customer.lastName} {data.customer.firstName}
              {data.customer.middleName ? ` ${data.customer.middleName}` : ''}
            </h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-neutral-500">Телефон</dt>
                <dd className="font-medium">{data.customer.phone}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Email</dt>
                <dd className="font-medium">{data.customer.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Telegram</dt>
                <dd className="font-medium">{data.customer.telegramUsername ? `@${data.customer.telegramUsername.replace(/^@/, '')}` : '—'}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Клиент с</dt>
                <dd className="font-medium">{dstr(data.customer.createdAt)}</dd>
              </div>
            </dl>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md bg-neutral-50 p-3">
                <p className="text-xs uppercase text-neutral-500">Заявок</p>
                <p className="text-lg font-bold">{data.stats.bookingsCount}</p>
              </div>
              <div className="rounded-md bg-neutral-50 p-3">
                <p className="text-xs uppercase text-neutral-500">Сумма всех</p>
                <p className="text-lg font-bold">{money(data.stats.totalAmount)}</p>
              </div>
              <div className="rounded-md bg-emerald-50 p-3">
                <p className="text-xs uppercase text-emerald-700">Оплачено</p>
                <p className="text-lg font-bold text-emerald-800">{money(data.stats.paidAmount)}</p>
              </div>
              <div className="rounded-md bg-neutral-50 p-3">
                <p className="text-xs uppercase text-neutral-500">Туристов</p>
                <p className="text-lg font-bold">{data.stats.tourists}</p>
              </div>
            </div>
          </section>

          {/* Комментарий менеджера (§23) */}
          <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-neutral-700">Комментарий менеджера</h3>
            <Field label="Заметка видна всем сотрудникам с доступом к CRM">
              <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: постоянный клиент, предпочитает утренние выезды…" />
            </Field>
            <div className="mt-2 flex items-center gap-3">
              <Button busy={noteSaving} disabled={noteSaving} onClick={() => void saveNote()}>
                Сохранить
              </Button>
              {noteOk ? <SuccessBanner message="Комментарий сохранён" /> : null}
            </div>
          </section>

          {/* Поездки / заявки */}
          <section className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-neutral-700">Поездки и заявки</h3>
            {data.bookings.length === 0 ? (
              <EmptyState title="У клиента пока нет заявок" />
            ) : (
              <div className="space-y-3">
                {data.bookings.map((b) => (
                  <article key={b.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-sm text-neutral-500">{b.bookingNumber}</span>{' '}
                        <span className="ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium">
                          {STATUS_LABELS[b.status as BookingStatusValue] ?? b.status}
                        </span>
                        <span className="ml-2 text-xs text-neutral-400">{b.source === 'TELEGRAM' ? 'Telegram' : 'Сайт'}</span>
                      </div>
                      <div className="text-sm font-semibold">{money(b.totalAmount)} {b.currency}</div>
                    </div>
                    {b.departure?.tour ? (
                      <p className="mt-1 text-sm text-neutral-700">
                        <Link href={`/tours/${b.departure.tour.slug}/edit`} className="text-brand-700 hover:underline">
                          {b.departure.tour.title}
                        </Link>{' '}
                        · {dstr(b.departure.startDate)}
                        {b.departureCity ? ` · выезд из: ${b.departureCity.name}` : ''} ·{' '}
                        {b.adults} взр.
                        {b.children10to14 ? `, ${b.children10to14} дет. 10–14` : ''}
                        {b.childrenUnder10 ? `, ${b.childrenUnder10} мал.` : ''}
                      </p>
                    ) : null}
                    {b.assignedManager ? (
                      <p className="mt-1 text-xs text-neutral-500">
                        Менеджер: {b.assignedManager.firstName} {b.assignedManager.lastName}
                      </p>
                    ) : null}
                    {b.history.length > 1 ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-neutral-500">История изменений ({b.history.length})</summary>
                        <ul className="mt-1 space-y-1 border-l border-neutral-200 pl-3 text-xs text-neutral-600">
                          {b.history.map((h) => (
                            <li key={h.id}>
                              <span className="text-neutral-400">{new Date(h.createdAt).toLocaleString('ru-RU')}</span> —{' '}
                              {h.fromStatus && h.fromStatus !== h.toStatus
                                ? `${STATUS_LABELS[h.fromStatus] ?? h.fromStatus} → ${STATUS_LABELS[h.toStatus] ?? h.toStatus}`
                                : STATUS_LABELS[h.toStatus] ?? h.toStatus}
                              {h.note ? ` · ${h.note}` : ''}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
