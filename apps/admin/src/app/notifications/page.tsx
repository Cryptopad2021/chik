'use client';

/**
 * Лента уведомлений (PHASE 11.5, ТЗ §35–36): события системы уведомлений —
 * канал (TELEGRAM/EMAIL/SYSTEM), статус (PENDING/SENT/FAILED/SKIPPED), получатель,
 * текст, ошибка. Фильтры + ручная повторная отправка FAILED (дубль cron-задачи §55).
 */
import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { AuthGuard } from '@/components/AuthGuard';
import { EmptyState, ErrorBanner, Select, SkeletonRows } from '@/components/ui';
import {
  fetchNotifications,
  retryFailedNotifications,
  type NotificationRow,
} from '@/lib/api';

const EVENT_LABELS: Record<string, string> = {
  'booking.created': 'Заявка создана',
  'booking.confirmed': 'Заявка подтверждена',
  'booking.cancelled': 'Заявка отменена',
  'booking.paid': 'Оплата получена',
  'departure.updated': 'Выезд изменён',
  'departure.tomorrow': 'Напоминание о выезде',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает',
  SENT: 'Отправлено',
  FAILED: 'Ошибка',
  SKIPPED: 'Пропущено',
};

const CHANNEL_LABELS: Record<string, string> = {
  TELEGRAM: 'Telegram',
  EMAIL: 'Email',
  SYSTEM: 'Система',
  SMS: 'SMS',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  SENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  SKIPPED: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <NotificationsInner />
    </AuthGuard>
  );
}

function NotificationsInner() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [event, setEvent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const perPage = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchNotifications({
      status: status || undefined,
      event: event || undefined,
      page,
      perPage,
    });
    if (res.ok && res.data) {
      setItems(res.data.items);
      setTotal(res.data.total);
    } else {
      setError(res.error?.message ?? 'Ошибка запроса');
    }
    setLoading(false);
  }, [status, event, page]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const onRetry = async () => {
    setRetrying(true);
    setRetryMsg(null);
    const res = await retryFailedNotifications(20);
    if (res.ok && res.data) {
      setRetryMsg(`Повторно отправлено: ${res.data.retriedSent}`);
      await load();
    } else {
      setError(res.error?.message ?? 'Не удалось выполнить повтор');
    }
    setRetrying(false);
  };

  const pages = Math.max(Math.ceil(total / perPage), 1);

  return (
    <AdminShell title="Уведомления">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Статус</label>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Все</option>
              <option value="PENDING">Ожидает</option>
              <option value="SENT">Отправлено</option>
              <option value="FAILED">Ошибка</option>
              <option value="SKIPPED">Пропущено (флаг выкл.)</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Событие</label>
            <Select value={event} onChange={(e) => { setEvent(e.target.value); setPage(1); }}>
              <option value="">Все</option>
              {Object.entries(EVENT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {retrying ? 'Отправляю…' : 'Повторить ошибки'}
          </button>
          {retryMsg && <span className="text-sm text-emerald-700">{retryMsg}</span>}
        </div>

        {loading ? (
          <SkeletonRows rows={8} cols={4} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Уведомлений нет"
            description="События бронирований и напоминания планировщика появятся здесь автоматически (§35)."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Время</th>
                    <th className="px-4 py-2 font-medium">Событие</th>
                    <th className="px-4 py-2 font-medium">Канал</th>
                    <th className="px-4 py-2 font-medium">Статус</th>
                    <th className="px-4 py-2 font-medium">Сообщение</th>
                    <th className="px-4 py-2 font-medium">Получатель</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {items.map((n) => (
                    <tr key={n.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-neutral-600">
                        {new Date(n.createdAt).toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 py-2 font-medium">{EVENT_LABELS[n.event] ?? n.event}</td>
                      <td className="px-4 py-2 text-neutral-600">{CHANNEL_LABELS[n.channel] ?? n.channel}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[n.status] ?? 'border-neutral-200 bg-neutral-50 text-neutral-600'}`}
                        >
                          {STATUS_LABELS[n.status] ?? n.status}
                        </span>
                        {n.error && (
                          <span className="mt-1 block max-w-[220px] truncate text-xs text-red-600" title={n.error}>
                            {n.error}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[320px] px-4 py-2 text-neutral-600">
                        <span className="block truncate font-medium" title={n.payload.title ?? ''}>
                          {n.payload.title ?? '—'}
                        </span>
                        <span className="block truncate text-xs text-neutral-500" title={n.payload.body ?? ''}>
                          {n.payload.body ?? ''}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-2 text-xs text-neutral-500" title={n.target ?? ''}>
                        {n.target ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3 text-sm text-neutral-600">
              <button
                type="button"
                className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                ← Назад
              </button>
              <span>
                Стр. {page} из {pages} (всего {total})
              </span>
              <button
                type="button"
                className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-40"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(p + 1, pages))}
              >
                Вперёд →
              </button>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
