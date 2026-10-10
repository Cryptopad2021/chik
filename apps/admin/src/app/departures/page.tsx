'use client';

/**
 * Управление выездами (PHASE 9.5, ТЗ §21): расписание по турам, места/забронировано/
 * свободно/% заполнения, создание/редактирование, закрытие продаж, пересчёт мест,
 * удаление с подтверждением (§66). Фильтр ?tourId= из страницы тура.
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  Select,
  SkeletonRows,
  SuccessBanner,
  TextArea,
  TextInput,
} from '@/components/ui';
import {
  closeDepartureSales,
  createDeparture,
  deleteDeparture,
  fetchCities,
  fetchDepartures,
  fetchTours,
  recalculateDepartureSeats,
  updateDeparture,
  type CityRow,
  type DepartureRow,
  type TourRow,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { roleAllows } from '@/lib/permissions';

const STATUS_LABEL: Record<DepartureRow['status'], string> = {
  OPEN: 'Открыт',
  ALMOST_FULL: 'Почти полный',
  FULL: 'Заполнен',
  CANCELLED: 'Отменён',
  COMPLETED: 'Завершён',
};

const STATUS_BADGE: Record<DepartureRow['status'], string> = {
  OPEN: 'bg-green-100 text-green-800',
  ALMOST_FULL: 'bg-amber-100 text-amber-800',
  FULL: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-neutral-200 text-neutral-600',
  COMPLETED: 'bg-sky-100 text-sky-800',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU');
}

interface EditState {
  id: string | null; // null = создание
  tourId: string;
  startDate: string;
  endDate: string;
  totalSeats: number;
  price: number;
  status: DepartureRow['status'];
  notes: string;
  cityIds: string[];
}

function DeparturesInner() {
  const { user } = useAuth();
  const canEdit = roleAllows(user?.role, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
  const searchParams = useSearchParams();
  const tourIdParam = searchParams.get('tourId') ?? '';

  const [rows, setRows] = useState<DepartureRow[]>([]);
  const [tours, setTours] = useState<TourRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [tourFilter, setTourFilter] = useState(tourIdParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DepartureRow | null>(null);
  const [confirmOverride, setConfirmOverride] = useState(false);
  const [closeTarget, setCloseTarget] = useState<DepartureRow | null>(null);
  const [closeOverride, setCloseOverride] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchDepartures({ tourId: tourFilter || undefined });
    if (res.ok && Array.isArray(res.data)) {
      setRows(res.data);
      setError(null);
    } else {
      setError(res.error?.message ?? 'Не удалось загрузить выезды');
    }
    setLoading(false);
  }, [tourFilter]);

  useEffect(() => {
    // Синхронизация с внешним API: загрузка списка при монтировании/смене фильтров
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t, c] = await Promise.all([
        fetchTours({ perPage: 50 }),
        fetchCities(),
      ]);
      if (cancelled) return;
      if (t.ok && t.data) setTours(t.data.items);
      if (c.ok && Array.isArray(c.data)) setCities(c.data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function openCreate() {
    setEdit({
      id: null,
      tourId: tourFilter || tours[0]?.id || '',
      startDate: '',
      endDate: '',
      totalSeats: 18,
      price: 0,
      status: 'OPEN',
      notes: '',
      cityIds: [],
    });
    setConfirmOverride(false);
  }

  function openEdit(d: DepartureRow) {
    setEdit({
      id: d.id,
      tourId: d.tourId,
      startDate: d.startDate.slice(0, 10),
      endDate: d.endDate.slice(0, 10),
      totalSeats: d.totalSeats,
      price: d.price,
      status: d.status,
      notes: d.notes ?? '',
      cityIds: (d.cities ?? []).map((c) => c.departureCity?.id).filter(Boolean) as string[],
    });
    setConfirmOverride(false);
  }

  async function onSave() {
    if (!edit) return;
    if (!edit.tourId || !edit.startDate || !edit.endDate) {
      setError('Заполните тур и даты');
      return;
    }
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      startDate: edit.startDate,
      endDate: edit.endDate,
      totalSeats: Number(edit.totalSeats),
      price: Number(edit.price),
      status: edit.status,
      notes: edit.notes || undefined,
      cities: edit.cityIds.map((departureCityId) => ({ departureCityId })),
    };
    const res = edit.id
      ? await updateDeparture(edit.id, body)
      : await createDeparture({ ...body, tourId: edit.tourId });
    setBusy(false);
    if (res.ok) {
      setEdit(null);
      setNotice('Выезд сохранён');
      void load();
    } else {
      setError(res.error?.message ?? 'Не удалось сохранить выезд');
    }
  }

  async function onCloseSales(d: DepartureRow, override: boolean) {
    setBusy(true);
    const res = await closeDepartureSales(d.id, override);
    setBusy(false);
    if (res.ok) {
      setNotice('Продажи закрыты');
      setCloseTarget(null);
      setCloseOverride(false);
      void load();
    } else {
      setError(res.error?.message ?? 'Не удалось закрыть продажи');
      if (res.status === 409) {
        setCloseTarget(d);
        setCloseOverride(true);
      }
    }
  }

  async function onRecalc(d: DepartureRow) {
    const res = await recalculateDepartureSeats(d.id);
    if (res.ok) {
      setNotice(`Места пересчитаны: забронировано ${(res.data as DepartureRow).bookedSeats}`);
      void load();
    } else {
      setError(res.error?.message ?? 'Пересчёт не выполнен');
    }
  }

  async function onDelete(override: boolean) {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await deleteDeparture(deleteTarget.id, override);
    setBusy(false);
    if (res.ok) {
      setNotice('Выезд удалён');
      setDeleteTarget(null);
      setConfirmOverride(false);
      void load();
    } else {
      setError(res.error?.message ?? 'Не удалось удалить выезд');
      if (res.status === 409) setConfirmOverride(true);
    }
  }

  return (
    <AdminShell title="Выезды">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="w-72">
            <Field label="Тур">
              <Select value={tourFilter} onChange={(e) => setTourFilter(e.target.value)} aria-label="Фильтр по туру">
                <option value="">Все туры</option>
                {tours.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {canEdit && (
            <Button className="ml-auto" onClick={openCreate} disabled={!tours.length}>
              + Новый выезд
            </Button>
          )}
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {notice && <SuccessBanner message={notice} />}

        {loading ? (
          <SkeletonRows rows={6} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState title="Выездов нет" description="Создайте первый выезд для тура." action={canEdit ? <Button onClick={openCreate} disabled={!tours.length}>+ Новый выезд</Button> : undefined} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-4 py-2 font-medium">Тур</th>
                  <th className="px-4 py-2 font-medium">Даты</th>
                  <th className="px-4 py-2 font-medium">Города</th>
                  <th className="px-4 py-2 font-medium">Места</th>
                  <th className="px-4 py-2 font-medium">Заполнение</th>
                  <th className="px-4 py-2 font-medium">Цена</th>
                  <th className="px-4 py-2 font-medium">Статус</th>
                  {canEdit && <th className="px-4 py-2 font-medium">Действия</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-2.5">{d.tour?.title ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {fmtDate(d.startDate)} → {fmtDate(d.endDate)}
                    </td>
                    <td className="max-w-40 truncate px-4 py-2.5 text-neutral-600">
                      {(d.cities ?? []).map((c) => c.departureCity?.name).filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {d.bookedSeats}/{d.totalSeats} (свободно {d.availableSeats})
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-200">
                          <div
                            className={`h-full rounded-full ${d.fillPercent >= 100 ? 'bg-red-500' : d.fillPercent >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(d.fillPercent, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-neutral-600">{d.fillPercent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{Number(d.price).toLocaleString('ru-RU')} ₽</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <Button variant="secondary" onClick={() => openEdit(d)}>Изм.</Button>
                          {(d.status === 'OPEN' || d.status === 'ALMOST_FULL' || d.status === 'FULL') && (
                            <Button variant="ghost" onClick={() => void onCloseSales(d, false)} disabled={busy}>
                              Закрыть продажи
                            </Button>
                          )}
                          <Button variant="ghost" onClick={() => void onRecalc(d)} disabled={busy} title="Сверить bookedSeats с фактическими бронями">
                            Пересчёт мест
                          </Button>
                          <Button variant="ghost" onClick={() => setDeleteTarget(d)} disabled={busy}>
                            Удалить
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Модалка создания/редактирования */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Выезд">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{edit.id ? 'Редактировать выезд' : 'Новый выезд'}</h2>
            <div className="space-y-3">
              {!edit.id && (
                <Field label="Тур *">
                  <Select value={edit.tourId} onChange={(e) => setEdit({ ...edit, tourId: e.target.value })}>
                    {tours.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Начало *"><TextInput type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} /></Field>
                <Field label="Окончание *"><TextInput type="date" value={edit.endDate} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Мест *" hint={edit.id ? `Забронировано: ${rows.find((r) => r.id === edit.id)?.bookedSeats ?? 0}` : undefined}>
                  <TextInput type="number" min={1} value={edit.totalSeats} onChange={(e) => setEdit({ ...edit, totalSeats: Number(e.target.value) })} />
                </Field>
                <Field label="Цена, ₽ *"><TextInput type="number" min={0} value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></Field>
              </div>
              <Field label="Статус">
                <Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as DepartureRow['status'] })}>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Города отправления">
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
                  {cities.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={edit.cityIds.includes(c.id)}
                        disabled={!c.isActive}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            cityIds: e.target.checked ? [...edit.cityIds, c.id] : edit.cityIds.filter((x) => x !== c.id),
                          })
                        }
                      />
                      {c.name} {!c.isActive && <span className="text-xs text-neutral-400">(неактивен)</span>}
                    </label>
                  ))}
                  {!cities.length && <p className="text-sm text-neutral-500">Города не заведены.</p>}
                </div>
              </Field>
              <Field label="Заметки"><TextArea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEdit(null)} disabled={busy}>Отмена</Button>
              <Button onClick={() => void onSave()} busy={busy}>Сохранить</Button>
            </div>
          </div>
        </div>
      )}

      {/* Подтверждения (§66) — при активных бронях API требует confirm=true */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить выезд?"
        description={
          confirmOverride
            ? 'У выезда есть активные брони. Они будут отменены, а места освобождены. Подтвердите повторным нажатием.'
            : 'Выезд и связанные с ним данные будут удалены безвозвратно.'
        }
        busy={busy}
        onConfirm={() => void onDelete(confirmOverride)}
        onCancel={() => {
          setDeleteTarget(null);
          setConfirmOverride(false);
        }}
      />
      {closeTarget && (
        <ConfirmDialog
          open
          title="Закрыть продажи с активными бронями?"
          description="У этого выезда есть активные брони. Они останутся, но новые брони будут невозможны. Подтвердите повторным нажатием."
          confirmLabel="Закрыть"
          busy={busy}
          onConfirm={() => void onCloseSales(closeTarget, closeOverride)}
          onCancel={() => {
            setCloseTarget(null);
            setCloseOverride(false);
          }}
        />
      )}
    </AdminShell>
  );
}

export default function DeparturesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-neutral-500">Загрузка…</div>}>
      <DeparturesInner />
    </Suspense>
  );
}
