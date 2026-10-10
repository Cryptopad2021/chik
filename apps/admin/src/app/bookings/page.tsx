'use client';

/**
 * Заявки (PHASE 9.6, ТЗ §22): список с фильтром по статусу и поиском,
 * карточка заявки — смена статуса (машина переходов §15), назначение
 * менеджера, комментарий менеджера.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { useAuth } from '@/lib/auth-context';
import { roleIs } from '@/lib/permissions';
import {
  addBookingComment,
  assignBookingManager,
  fetchBookings,
  fetchUsers,
  setBookingStatus,
  type BookingRow,
  type BookingStatusValue,
  type UserRow,
} from '@/lib/api';
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  Pagination,
  Select,
  SkeletonRows,
  SuccessBanner,
  TextArea,
  TextInput,
} from '@/components/ui';

const STATUS_LABELS: Record<BookingStatusValue, string> = {
  NEW: 'Новая',
  CONTACTED: 'Контакт установлен',
  PENDING_CONFIRMATION: 'Ждёт подтверждения',
  CONFIRMED: 'Подтверждена',
  PAYMENT_PENDING: 'Ожидает оплаты',
  PAID: 'Оплачена',
  CANCELLED: 'Отменена',
  COMPLETED: 'Завершена',
  REFUNDED: 'Возврат',
};

// Машина переходов, зеркальная к BookingsService.ALLOWED_TRANSITIONS (§15)
const ALLOWED_TRANSITIONS: Record<BookingStatusValue, BookingStatusValue[]> = {
  NEW: ['CONTACTED', 'CONFIRMED', 'CANCELLED'],
  CONTACTED: ['PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED'],
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PAYMENT_PENDING', 'PAID', 'CANCELLED'],
  PAYMENT_PENDING: ['PAID', 'CANCELLED'],
  PAID: ['COMPLETED', 'REFUNDED'],
  CANCELLED: [],
  COMPLETED: [],
  REFUNDED: [],
};

const STATUS_COLORS: Record<BookingStatusValue, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-cyan-100 text-cyan-800',
  PENDING_CONFIRMATION: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  PAYMENT_PENDING: 'bg-orange-100 text-orange-800',
  PAID: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-neutral-200 text-neutral-700',
  COMPLETED: 'bg-violet-100 text-violet-800',
  REFUNDED: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: BookingStatusValue }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function BookingsPage() {
  const { user } = useAuth();
  const canManage = roleIs(user?.role, 'SUPER_ADMIN', 'ADMIN', 'MANAGER');

  const [rows, setRows] = useState<BookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<BookingRow | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);

  const [nextStatus, setNextStatus] = useState<BookingStatusValue | ''>('');
  const [statusNote, setStatusNote] = useState('');
  const [commentText, setCommentText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchBookings({
      status: statusFilter || undefined,
      search: search || undefined,
      page,
      perPage,
    });
    if (res.ok && res.data) {
      setRows(res.data.items);
      setTotal(res.data.total);
      setError(null);
    } else {
      setError(res.error?.message ?? 'Не удалось загрузить заявки');
    }
    setLoading(false);
  }, [statusFilter, search, page]);

  useEffect(() => {
    // Синхронизация с внешним API: загрузка списка при монтировании/смене фильтров
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    void (async () => {
      const res = await fetchUsers();
      if (res.ok && Array.isArray(res.data)) {
        setUsers(res.data.filter((u) => u.isActive));
      }
    })();
  }, [canManage]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const transitions = useMemo<BookingStatusValue[]>(
    () => (selected ? ALLOWED_TRANSITIONS[selected.status] ?? [] : []),
    [selected],
  );

  function openCard(b: BookingRow) {
    setSelected(b);
    setNextStatus('');
    setStatusNote('');
    setCommentText('');
    setNotice(null);
    setError(null);
  }

  async function onChangeStatus() {
    if (!selected || !nextStatus) return;
    setBusy(true);
    const res = await setBookingStatus(selected.id, nextStatus, statusNote || undefined);
    setBusy(false);
    if (res.ok) {
      setNotice(`Статус изменён: ${STATUS_LABELS[nextStatus]}`);
      setSelected(null);
      void load();
    } else {
      setError(res.error?.message ?? 'Не удалось изменить статус');
    }
  }

  async function onAssignManager(managerId: string) {
    if (!selected) return;
    setBusy(true);
    const res = await assignBookingManager(selected.id, managerId || null);
    setBusy(false);
    if (res.ok) {
      setNotice(managerId ? 'Менеджер назначен' : 'Менеджер снят');
      setSelected(null);
      void load();
    } else {
      setError(res.error?.message ?? 'Не удалось назначить менеджера');
    }
  }

  async function onAddComment() {
    if (!selected || !commentText.trim()) return;
    setBusy(true);
    const res = await addBookingComment(selected.id, commentText.trim());
    setBusy(false);
    if (res.ok) {
      setNotice('Комментарий добавлен');
      setCommentText('');
    } else {
      setError(res.error?.message ?? 'Не удалось добавить комментарий');
    }
  }

  return (
    <AdminShell title="Заявки">
      <div className="space-y-4">
        {/* Фильтры */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="w-56">
            <Field label="Статус">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Фильтр по статусу"
              >
                <option value="">Все статусы</option>
                {(Object.keys(STATUS_LABELS) as BookingStatusValue[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-72">
            <Field label="Поиск">
              <TextInput
                value={searchInput}
                placeholder="Имя, телефон, email, номер заявки"
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch(searchInput.trim());
                    setPage(1);
                  }
                }}
              />
            </Field>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch(searchInput.trim());
              setPage(1);
            }}
          >
            Найти
          </Button>
          <p className="ml-auto text-sm text-neutral-500">Всего: {total}</p>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {notice && <SuccessBanner message={notice} />}

        {/* Таблица */}
        {loading ? (
          <SkeletonRows rows={6} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState title="Заявок не найдено" description="Попробуйте изменить фильтры или поиск." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">№</th>
                  <th className="px-4 py-3">Клиент</th>
                  <th className="px-4 py-3">Тур / дата</th>
                  <th className="px-4 py-3">Гостей</th>
                  <th className="px-4 py-3">Сумма</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Менеджер</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{b.bookingNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">
                        {b.customer ? `${b.customer.firstName} ${b.customer.lastName}` : '—'}
                      </div>
                      <div className="text-xs text-neutral-500">{b.customer?.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{b.departure?.tour?.title ?? '—'}</div>
                      <div className="text-xs text-neutral-500">
                        {b.departure ? new Date(b.departure.startDate).toLocaleDateString('ru-RU') : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">{b.adults + b.children10to14 + b.childrenUnder10}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {Number(b.totalAmount).toLocaleString('ru-RU')} {b.currency}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600">
                      {b.assignedManager ? `${b.assignedManager.firstName} ${b.assignedManager.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" onClick={() => openCard(b)}>
                        Открыть
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </div>

      {/* Карточка заявки */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Заявка {selected.bookingNumber}</h3>
                <div className="mt-1">
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <Button variant="ghost" onClick={() => setSelected(null)} disabled={busy}>
                ✕
              </Button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-neutral-500">Клиент</dt>
              <dd className="text-neutral-900">
                {selected.customer ? `${selected.customer.firstName} ${selected.customer.lastName}` : '—'}
              </dd>
              <dt className="text-neutral-500">Телефон</dt>
              <dd>{selected.customer?.phone ?? '—'}</dd>
              <dt className="text-neutral-500">Email</dt>
              <dd>{selected.customer?.email ?? '—'}</dd>
              <dt className="text-neutral-500">Тур</dt>
              <dd>{selected.departure?.tour?.title ?? '—'}</dd>
              <dt className="text-neutral-500">Дата выезда</dt>
              <dd>{selected.departure ? new Date(selected.departure.startDate).toLocaleDateString('ru-RU') : '—'}</dd>
              <dt className="text-neutral-500">Гости</dt>
              <dd>
                Взрослые: {selected.adults}, дети 10–14: {selected.children10to14}, до 10: {selected.childrenUnder10}
              </dd>
              <dt className="text-neutral-500">Сумма</dt>
              <dd>
                {Number(selected.totalAmount).toLocaleString('ru-RU')} {selected.currency}
              </dd>
              <dt className="text-neutral-500">Создана</dt>
              <dd>{new Date(selected.createdAt).toLocaleString('ru-RU')}</dd>
            </dl>

            {canManage && (
              <div className="mt-5 space-y-4 border-t border-neutral-200 pt-4">
                <Field label="Назначить менеджера">
                  <Select
                    defaultValue={selected.assignedManager?.id ?? ''}
                    disabled={busy}
                    onChange={(e) => void onAssignManager(e.target.value)}
                  >
                    <option value="">Без менеджера</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.role})
                      </option>
                    ))}
                  </Select>
                </Field>

                {transitions.length > 0 && (
                  <div className="space-y-2">
                    <Field label="Сменить статус">
                      <Select
                        value={nextStatus}
                        disabled={busy}
                        onChange={(e) => setNextStatus(e.target.value as BookingStatusValue)}
                      >
                        <option value="">— выберите новый статус —</option>
                        {transitions.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {nextStatus && (
                      <>
                        <TextArea
                          placeholder="Комментарий к смене статуса (попадет в историю)"
                          value={statusNote}
                          onChange={(e) => setStatusNote(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <Button onClick={() => void onChangeStatus()} busy={busy} disabled={!nextStatus}>
                            Применить
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 border-t border-neutral-200 pt-4">
              <Field label="Комментарий менеджера">
                <TextArea
                  placeholder="Добавить заметку по заявке…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
              </Field>
              <div className="mt-2 flex justify-end">
                <Button variant="secondary" onClick={() => void onAddComment()} busy={busy} disabled={!commentText.trim()}>
                  Добавить комментарий
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
