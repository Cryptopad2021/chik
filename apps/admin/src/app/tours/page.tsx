'use client';

/**
 * Список туров (PHASE 9.4, ТЗ §20): поиск, фильтр статуса, пагинация,
 * архивирование с подтверждением (§66), создание.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/AdminShell';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  Pagination,
  Select,
  SkeletonRows,
  TextInput,
} from '@/components/ui';
import { archiveTour, fetchTours, type TourRow, type TourStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { roleAllows } from '@/lib/permissions';

const STATUS_LABEL: Record<TourStatus, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликован',
  ARCHIVED: 'В архиве',
};

const STATUS_BADGE: Record<TourStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-neutral-200 text-neutral-600',
};

export default function ToursListPage() {
  const { user } = useAuth();
  const canEdit = roleAllows(user?.role, ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER']);

  const [rows, setRows] = useState<TourRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TourStatus | ''>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TourRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchTours({ status: status || undefined, search: search || undefined, page, perPage: 20 });
    if (res.ok && res.data) {
      setRows(res.data.items);
      setTotal(res.data.total);
    } else {
      setError(res.error?.message ?? 'Не удалось загрузить туры');
    }
    setLoading(false);
  }, [status, search, page]);

  useEffect(() => {
    // Синхронизация с внешним API: загрузка списка при монтировании/смене фильтров
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, reloadKey]);

  async function onArchive() {
    if (!archiveTarget) return;
    setBusyId(archiveTarget.id);
    const res = await archiveTour(archiveTarget.id);
    setBusyId(null);
    setArchiveTarget(null);
    if (res.ok) {
      setReloadKey((k) => k + 1);
    } else {
      setError(res.error?.message ?? 'Не удалось архивировать тур');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <AdminShell title="Туры">
      <div className="space-y-4">
        {/* Панель фильтров (§65) */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <div className="w-56">
              <Field label="Поиск">
                <TextInput
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Название или описание"
                  aria-label="Поиск по турам"
                />
              </Field>
            </div>
            <div className="w-44">
              <Field label="Статус">
                <Select
                  value={status}
                  onChange={(e) => {
                    setPage(1);
                    setStatus(e.target.value as TourStatus | '');
                  }}
                  aria-label="Фильтр по статусу"
                >
                  <option value="">Все</option>
                  <option value="DRAFT">Черновики</option>
                  <option value="PUBLISHED">Опубликованные</option>
                  <option value="ARCHIVED">Архив</option>
                </Select>
              </Field>
            </div>
            <Button type="submit">Применить</Button>
          </form>
          {canEdit && (
            <Link href="/tours/new" className="ml-auto">
              <Button>+ Новый тур</Button>
            </Link>
          )}
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {loading ? (
          <SkeletonRows rows={6} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Туров не найдено"
            description="Измените фильтры или создайте первый тур."
            action={
              canEdit ? (
                <Link href="/tours/new">
                  <Button>Создать тур</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-4 py-2 font-medium">Тур</th>
                  <th className="px-4 py-2 font-medium">Направление</th>
                  <th className="px-4 py-2 font-medium">Длительность</th>
                  <th className="px-4 py-2 font-medium">Цена</th>
                  <th className="px-4 py-2 font-medium">Статус</th>
                  <th className="px-4 py-2 font-medium">Выездов</th>
                  <th className="px-4 py-2 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-neutral-500">/{t.slug}</div>
                    </td>
                    <td className="px-4 py-2.5">{t.destination?.name ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {t.durationDays} дн. / {t.durationNights} ноч.
                    </td>
                    <td className="px-4 py-2.5">{Number(t.basePrice).toLocaleString('ru-RU')} ₽</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{t._count?.departures ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <Link href={`/tours/${t.slug}/edit`}>
                          <Button variant="secondary">{canEdit ? 'Редактировать' : 'Просмотр'}</Button>
                        </Link>
                        {canEdit && t.status !== 'ARCHIVED' && (
                          <Button variant="ghost" onClick={() => setArchiveTarget(t)} disabled={busyId === t.id}>
                            В архив
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-3">
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!archiveTarget}
        title="Архивировать тур?"
        description={`«${archiveTarget?.title}» будет скрыт с сайта (soft delete). Его выезды останутся в системе.`}
        confirmLabel="Архивировать"
        busy={busyId === archiveTarget?.id}
        onConfirm={() => void onArchive()}
        onCancel={() => setArchiveTarget(null)}
      />
    </AdminShell>
  );
}
