'use client';

/**
 * Дашборд (PHASE 9.3, ТЗ §19): реальные метрики — новые заявки (всего/сегодня),
 * на подтверждении, оплаченные, туристы, выручка, ближайшие выезды, заполняемость,
 * график заявок за 30 дней, последние действия. Empty state при нуле (§68).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/AdminShell';
import {
  fetchDashboard,
  type DashboardData,
  type BookingStatusValue,
} from '@/lib/api';
import { Button, ErrorBanner, SkeletonRows, EmptyState } from '@/components/ui';

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

const money = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
const dt = (s: string) => new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
const dts = (s: string) =>
  new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function Card({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? 'border-brand-200 bg-brand-50' : 'border-neutral-200 bg-white'}`}>
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

function Chart({ data }: { data: DashboardData['chart'] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-32 items-end gap-[2px]" role="img" aria-label="График заявок за период">
      {data.map((d) => (
        <div key={d.date} className="group relative flex-1" title={`${d.date}: ${d.count} заявок, ${money(d.revenue)}`}>
          <div
            className="w-full rounded-t bg-brand-500 transition-colors group-hover:bg-brand-700"
            style={{ height: `${Math.max(2, (d.count / max) * 120)}px` }}
          />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchDashboard(30);
    if (res.ok) setData(res.data ?? null);
    else setError(res.error?.message ?? 'Не удалось загрузить метрики');
    setLoading(false);
  }, []);

  useEffect(() => {
    // старт загрузки — после монтирования (microtask), без синхронного setState в эффекте
    void Promise.resolve().then(load);
  }, [load]);

  return (
    <AdminShell title="Дашборд">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading || !data ? (
        <SkeletonRows rows={6} cols={4} />
      ) : (
        <>
          {/* Карточки метрик */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card label="Новые заявки" value={String(data.cards.newTotal)} hint={`сегодня: ${data.cards.newToday}`} accent />
            <Card label="На связке" value={String(data.cards.contacted)} hint="контакт / ждёт подтверждения" />
            <Card label="Подтверждённые" value={String(data.cards.confirmedActive)} hint="подтв. + ожидает оплаты" />
            <Card label="Оплаченные" value={String(data.cards.paid)} hint={`завершено: ${data.cards.completed}`} />
            <Card label="Выручка" value={money(data.cards.revenue)} hint={`оплаченных заявок: ${data.cards.paidBookings}`} accent />
            <Card label="Туристы" value={String(data.cards.tourists)} hint="во всех активных заявках" />
            <Card label="Отменены" value={String(data.cards.cancelled)} hint="отмена + возврат" />
            <Card
              label="Заполняемость"
              value={`${data.occupancy.percent}%`}
              hint={`${data.occupancy.booked}/${data.occupancy.seats} мест · ${data.occupancy.departures} выездов`}
            />
          </div>

          {/* График заявок за 30 дней */}
          <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-neutral-700">Заявки за {data.periodDays} дней</h2>
            {data.chart.every((d) => d.count === 0) ? (
              <EmptyState title="Нет заявок за период" description="Как только появятся первые бронирования, здесь появится график." />
            ) : (
              <>
                <Chart data={data.chart} />
                <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
                  <span>{dt(data.chart[0]?.date ?? '')}</span>
                  <span>{dt(data.chart[data.chart.length - 1]?.date ?? '')}</span>
                </div>
              </>
            )}
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Ближайшие выезды (сегодня/завтра) */}
            <section className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-700">Ближайшие выезды</h2>
                <Link href="/departures" className="text-xs font-medium text-brand-700 hover:underline">
                  Все выезды →
                </Link>
              </div>
              {data.upcomingDepartures.length === 0 ? (
                <EmptyState title="Сегодня и завтра выездов нет" />
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {data.upcomingDepartures.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium text-neutral-900">{d.tour.title}</p>
                        <p className="text-xs text-neutral-500">
                          {new Date(d.startDate).toLocaleString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          d.availableSeats === 0 ? 'bg-red-100 text-red-800' : d.status === 'ALMOST_FULL' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {d.bookedSeats}/{d.totalSeats} · своб. {d.availableSeats}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Последние заявки */}
            <section className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-700">Последние заявки</h2>
                <Link href="/bookings" className="text-xs font-medium text-brand-700 hover:underline">
                  Все заявки →
                </Link>
              </div>
              {data.recentBookings.length === 0 ? (
                <EmptyState title="Заявок пока нет" description="Заявки с сайта появятся здесь автоматически." />
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {data.recentBookings.map((b) => (
                    <li key={b.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <Link href={`/customers/${b.customerId}`} className="font-medium text-brand-700 hover:underline">
                          {b.customer ? `${b.customer.firstName} ${b.customer.lastName}` : b.bookingNumber}
                        </Link>
                        <span className="text-xs text-neutral-500">{dts(b.createdAt)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium">
                          {STATUS_LABELS[b.status as BookingStatusValue] ?? b.status}
                        </span>
                        <span>{money(Number(b.totalAmount))}</span>
                        {b.departure?.tour ? <span className="truncate">· {b.departure.tour.title}</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Последние действия (audit) */}
          <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-700">Последние действия команды</h2>
              <Link href="/audit" className="text-xs font-medium text-brand-700 hover:underline">
                Журнал →
              </Link>
            </div>
            {data.recentActions.length === 0 ? (
              <EmptyState title="Действий пока нет" />
            ) : (
              <ul className="divide-y divide-neutral-100 text-sm">
                {data.recentActions.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-1.5">
                    <span className="text-neutral-700">
                      <span className="font-medium">{a.user ? `${a.user.firstName} ${a.user.lastName}` : 'Система'}</span>{' '}
                      <span className="text-neutral-500">{a.action}</span> · {a.entity}
                    </span>
                    <span className="text-xs text-neutral-400">{dts(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-6">
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Обновить
            </Button>
          </div>
        </>
      )}
    </AdminShell>
  );
}
