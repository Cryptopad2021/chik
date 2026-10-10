'use client';

/**
 * Аналитика (PHASE 12.3, ТЗ §71–73): воронка view→select→start→created→confirmed,
 * события по дням, топ туров, UTM-разрез, Telegram-активность.
 * Данные — только обезличенные события (ПДн в аналитику не пишутся, §72).
 */
import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { AuthGuard } from '@/components/AuthGuard';
import { ErrorBanner, Select, SkeletonRows } from '@/components/ui';
import {
  fetchAnalyticsEventsByDay,
  fetchAnalyticsFunnel,
  fetchAnalyticsTelegram,
  fetchAnalyticsTopTours,
  fetchAnalyticsUtm,
  type EventByDayRow,
  type FunnelData,
  type TelegramStats,
  type TopTourRow,
  type UtmRow,
} from '@/lib/api';

const STEP_LABELS: Record<string, string> = {
  view_tour: 'Просмотр тура',
  select_departure: 'Выбор даты',
  start_booking: 'Начало брони',
  booking_created: 'Заявка создана',
  booking_confirmed: 'Подтверждена',
};

const PERIODS = [
  { value: '7', label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
];

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-40 shrink-0 text-sm text-gray-600">{label}</span>
      <div className="h-5 flex-1 rounded bg-gray-100">
        <div className="h-5 rounded bg-indigo-500" style={{ width: `${Math.max(pct, value > 0 ? 3 : 0)}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-sm tabular-nums text-gray-800">{value}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [byDay, setByDay] = useState<EventByDayRow[]>([]);
  const [topTours, setTopTours] = useState<TopTourRow[]>([]);
  const [utm, setUtm] = useState<UtmRow[]>([]);
  const [tg, setTg] = useState<TelegramStats | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const n = Number(d);
      const [f, e, t, u, g] = await Promise.all([
        fetchAnalyticsFunnel(n),
        fetchAnalyticsEventsByDay(n),
        fetchAnalyticsTopTours(n),
        fetchAnalyticsUtm(n),
        fetchAnalyticsTelegram(n),
      ]);
      const failed = [f, e, t, u, g].find((r) => !r.ok);
      if (failed && !failed.ok) {
        setError(failed.error?.message ?? 'Ошибка загрузки аналитики');
      } else if (f.ok && e.ok && t.ok && u.ok && g.ok) {
        setFunnel(f.data ?? null);
        setByDay(e.data ?? []);
        setTopTours(t.data ?? []);
        setUtm(u.data ?? []);
        setTg(g.data ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить аналитику');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  // События по дням: суммируем все типы в один счётчик на день
  const dayTotals = new Map<string, number>();
  for (const r of byDay) dayTotals.set(r.day, (dayTotals.get(r.day) ?? 0) + r.count);
  const daysArr = [...dayTotals.entries()].slice(-14);
  const maxDay = Math.max(1, ...daysArr.map(([, c]) => c));

  return (
    <AuthGuard>
      <AdminShell title="Аналитика">
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm text-gray-600">
            Период{' '}
            <Select value={days} onChange={(e) => setDays(e.target.value)} className="ml-1 inline-block w-auto">
              {PERIODS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </label>
        </div>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {loading ? (
          <SkeletonRows rows={5} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Воронка заявок">
              {funnel ? (
                <>
                  {funnel.steps.map((s) => (
                    <Bar key={s.step} label={STEP_LABELS[s.step] ?? s.step} value={s.count} max={funnel.steps[0]?.count || 1} />
                  ))}
                  <p className="mt-3 text-sm text-gray-600">
                    Конверсия просмотр→подтверждение:{' '}
                    <b className="text-gray-900">{funnel.conversion != null ? `${funnel.conversion}%` : '—'}</b>
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Нет данных</p>
              )}
            </Card>

            <Card title="События по дням (последние 14)">
              {daysArr.length === 0 ? (
                <p className="text-sm text-gray-500">Нет событий за период</p>
              ) : (
                daysArr.map(([day, count]) => (
                  <Bar key={day} label={day.slice(5)} value={count} max={maxDay} />
                ))
              )}
            </Card>

            <Card title="Топ туров">
              {topTours.length === 0 ? (
                <p className="text-sm text-gray-500">Нет данных</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-1 pr-2 font-medium">Тур</th>
                      <th className="py-1 pr-2 text-right font-medium">Просмотры</th>
                      <th className="py-1 pr-2 text-right font-medium">Выбор дат</th>
                      <th className="py-1 text-right font-medium">Заявки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTours.map((t) => (
                      <tr key={t.tourId} className="border-b border-gray-100 last:border-0">
                        <td className="py-1.5 pr-2">{t.title}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{t.views}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{t.selects}</td>
                        <td className="py-1.5 text-right tabular-nums">{t.created}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <div className="space-y-5">
              <Card title="UTM-источники">
                {utm.length === 0 ? (
                  <p className="text-sm text-gray-500">Нет размеченного трафика</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {utm.slice(0, 10).map((u, i) => (
                      <li key={i} className="flex justify-between">
                        <span className="text-gray-700">
                          {u.utmSource}
                          {u.utmMedium ? ` / ${u.utmMedium}` : ''}
                          {u.utmCampaign ? ` / ${u.utmCampaign}` : ''}
                        </span>
                        <span className="tabular-nums font-medium">{u.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Telegram">
                {tg ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded bg-gray-50 p-3">
                      <div className="text-gray-500">Клики по кнопкам</div>
                      <div className="text-xl font-semibold">{tg.telegramClicks}</div>
                    </div>
                    <div className="rounded bg-gray-50 p-3">
                      <div className="text-gray-500">Публикаций</div>
                      <div className="text-xl font-semibold">{tg.publications}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Нет данных</p>
                )}
              </Card>
            </div>
          </div>
        )}
      </AdminShell>
    </AuthGuard>
  );
}
