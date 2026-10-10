'use client';

/**
 * Направления (PHASE 9.7): CRUD + быстрые действия.
 * Управление hero-слайдами карусели — на странице /hero.
 */
import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import {
  ConfirmDialog,
  Button,
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
  createDestination,
  deleteDestination,
  fetchDestinations,
  updateDestination,
  type DestinationRow,
} from '@/lib/api';

interface EditState {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
}

export default function DestinationsPage() {
  const [rows, setRows] = useState<DestinationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DestinationRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchDestinations();
    if (res.ok && Array.isArray(res.data)) {
      setRows(res.data);
      setError(null);
    } else {
      setError(res.error?.message ?? 'Не удалось загрузить направления');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Синхронизация с внешним API: загрузка списка при монтировании/смене фильтров
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function onSave() {
    if (!edit) return;
    if (!edit.name.trim()) {
      setError('Укажите название направления');
      return;
    }
    setBusy(true);
    const body = { name: edit.name.trim(), description: edit.description || undefined, isActive: edit.isActive };
    const res = edit.id ? await updateDestination(edit.id, body) : await createDestination(body);
    setBusy(false);
    if (res.ok) {
      setEdit(null);
      setNotice('Направление сохранено');
      void load();
    } else {
      setError(res.error?.message ?? 'Не удалось сохранить направление');
    }
  }

  async function onToggleActive(d: DestinationRow) {
    const res = await updateDestination(d.id, { isActive: !d.isActive });
    if (res.ok) {
      setNotice(d.isActive ? 'Направление скрыто' : 'Направление активно');
      void load();
    } else {
      setError(res.error?.message ?? 'Не удалось обновить');
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await deleteDestination(deleteTarget.id);
    setBusy(false);
    if (res.ok) {
      setNotice('Направление удалено');
      setDeleteTarget(null);
      void load();
    } else {
      setError(res.error?.message ?? 'Не удалось удалить направление');
      setDeleteTarget(null);
    }
  }

  return (
    <AdminShell title="Направления">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">Всего: {rows.length}</p>
          <Button onClick={() => setEdit({ name: '', description: '', isActive: true })}>Новое направление</Button>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {notice && <SuccessBanner message={notice} />}

        {loading ? (
          <SkeletonRows rows={5} cols={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Направлений нет"
            description="Создайте первое направление — оно появится в фильтрах туров."
            action={<Button onClick={() => setEdit({ name: '', description: '', isActive: true })}>Создать</Button>}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Название</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Туров</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">{d.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">{d.slug}</td>
                    <td className="px-4 py-3">{d._count?.tours ?? 0}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          d.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                        }`}
                      >
                        {d.isActive ? 'Активно' : 'Скрыто'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" onClick={() => setEdit({ id: d.id, name: d.name, description: d.description ?? '', isActive: d.isActive })}>
                          Изменить
                        </Button>
                        <Button variant="ghost" onClick={() => void onToggleActive(d)} disabled={busy}>
                          {d.isActive ? 'Скрыть' : 'Показать'}
                        </Button>
                        <Button variant="ghost" onClick={() => setDeleteTarget(d)}>
                          <span className="text-red-600">Удалить</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Модалка создания/редактирования */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-neutral-900">{edit.id ? 'Редактировать направление' : 'Новое направление'}</h3>
            <div className="mt-4 space-y-3">
              <Field label="Название">
                <TextInput value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus />
              </Field>
              <Field label="Описание" hint="Необязательно, используется на страницах направления">
                <TextArea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              </Field>
              <Field label="Статус">
                <Select value={edit.isActive ? '1' : '0'} onChange={(e) => setEdit({ ...edit, isActive: e.target.value === '1' })}>
                  <option value="1">Активно (видно на сайте)</option>
                  <option value="0">Скрыто</option>
                </Select>
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEdit(null)} disabled={busy}>
                Отмена
              </Button>
              <Button onClick={() => void onSave()} busy={busy}>
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить направление?"
        description={
          deleteTarget
            ? `Направление «${deleteTarget.name}» будет удалено. ${
                (deleteTarget._count?.tours ?? 0) > 0 ? 'К нему привязаны туры — API не позволит удалить, пока они есть.' : ''
              }`
            : ''
        }
        busy={busy}
        onConfirm={() => void onDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminShell>
  );
}
