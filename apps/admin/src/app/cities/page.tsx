'use client';

/**
 * Города отправления (PHASE 9.7): CRUD + мягкое скрытие (§ isActive).
 */
import { useCallback, useEffect, useState } from 'react';
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
  createCity,
  deleteCity,
  fetchCities,
  updateCity,
  type CityRow,
} from '@/lib/api';

interface EditState {
  id?: string;
  name: string;
  address: string;
  meetingInstructions: string;
  isActive: boolean;
}

export default function CitiesPage() {
  const [rows, setRows] = useState<CityRow[]>([]);
  const [showHidden, setShowHidden] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CityRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchCities(showHidden ? 'all' : undefined);
    if (res.ok && Array.isArray(res.data)) {
      setRows(res.data);
      setError(null);
    } else {
      setError(res.error?.message ?? 'Не удалось загрузить города');
    }
    setLoading(false);
  }, [showHidden]);

  useEffect(() => {
    // Синхронизация с внешним API: загрузка списка при монтировании/смене фильтров
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function onSave() {
    if (!edit) return;
    if (!edit.name.trim()) {
      setError('Укажите название города');
      return;
    }
    setBusy(true);
    const body = {
      name: edit.name.trim(),
      address: edit.address || undefined,
      meetingInstructions: edit.meetingInstructions || undefined,
      isActive: edit.isActive,
    };
    const res = edit.id ? await updateCity(edit.id, body) : await createCity(body);
    setBusy(false);
    if (res.ok) {
      setEdit(null);
      setNotice('Город сохранён');
      void load();
    } else {
      setError(res.error?.message ?? 'Не удалось сохранить город');
    }
  }

  async function onToggleActive(c: CityRow) {
    const res = await updateCity(c.id, { isActive: !c.isActive });
    if (res.ok) {
      setNotice(c.isActive ? 'Город скрыт из выбора' : 'Город снова доступен');
      void load();
    } else {
      setError(res.error?.message ?? 'Не удалось обновить');
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await deleteCity(deleteTarget.id);
    setBusy(false);
    if (res.ok) {
      setNotice('Город удалён');
      setDeleteTarget(null);
      void load();
    } else {
      setError(res.error?.message ?? 'Не удалось удалить город');
      setDeleteTarget(null);
    }
  }

  return (
    <AdminShell title="Города отправления">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            Показывать скрытые
          </label>
          <Button onClick={() => setEdit({ name: '', address: '', meetingInstructions: '', isActive: true })}>
            Новый город
          </Button>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {notice && <SuccessBanner message={notice} />}

        {loading ? (
          <SkeletonRows rows={5} cols={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Городов нет"
            description="Добавьте города отправления — они будут доступны при создании выездов."
            action={<Button onClick={() => setEdit({ name: '', address: '', meetingInstructions: '', isActive: true })}>Добавить</Button>}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Город</th>
                  <th className="px-4 py-3">Адрес сбора</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">{c.name}</td>
                    <td className="px-4 py-3 text-neutral-500">{c.address ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                        }`}
                      >
                        {c.isActive ? 'Активен' : 'Скрыт'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setEdit({
                              id: c.id,
                              name: c.name,
                              address: c.address ?? '',
                              meetingInstructions: c.meetingInstructions ?? '',
                              isActive: c.isActive,
                            })
                          }
                        >
                          Изменить
                        </Button>
                        <Button variant="ghost" onClick={() => void onToggleActive(c)} disabled={busy}>
                          {c.isActive ? 'Скрыть' : 'Показать'}
                        </Button>
                        <Button variant="ghost" onClick={() => setDeleteTarget(c)}>
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

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-neutral-900">{edit.id ? 'Редактировать город' : 'Новый город'}</h3>
            <div className="mt-4 space-y-3">
              <Field label="Название">
                <TextInput value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus />
              </Field>
              <Field label="Адрес сбора" hint="Место встречи участников">
                <TextInput value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
              </Field>
              <Field label="Инструкции для участников" hint="Показывается на странице выезда">
                <TextArea
                  value={edit.meetingInstructions}
                  onChange={(e) => setEdit({ ...edit, meetingInstructions: e.target.value })}
                />
              </Field>
              <Field label="Статус">
                <Select value={edit.isActive ? '1' : '0'} onChange={(e) => setEdit({ ...edit, isActive: e.target.value === '1' })}>
                  <option value="1">Активен (доступен при создании выездов)</option>
                  <option value="0">Скрыт</option>
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
        title="Удалить город?"
        description={
          deleteTarget
            ? `Город «${deleteTarget.name}» будет удалён. Если к нему привязаны активные выезды, API потребует подтверждения.`
            : ''
        }
        busy={busy}
        onConfirm={() => void onDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminShell>
  );
}
