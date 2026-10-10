'use client';

/**
 * Пользователи админки (PHASE 9.9, ТЗ §7, §18): создание сотрудников,
 * смена роли/пароля, деактивация. Доступ — SUPER_ADMIN/ADMIN.
 * Удаление — только через деактивацию (исторические записи аудита сохраняются).
 */
import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { AuthGuard } from '@/components/AuthGuard';
import { Button, ConfirmDialog, EmptyState, ErrorBanner, Field, Select, SkeletonRows, TextInput, useAsyncAction } from '@/components/ui';
import { createUser, deleteUser, fetchUsers, updateUser, type UserRow } from '@/lib/api';
import type { Role } from '@/lib/permissions';
import { useAuth } from '@/lib/auth-context';
import { roleIs } from '@/lib/permissions';

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Суперадмин',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  CONTENT_MANAGER: 'Контент-менеджер',
  VIEWER: 'Наблюдатель',
};

const ALL_ROLES = Object.keys(ROLE_LABELS) as Role[];

interface Draft {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  password: string;
  isActive: boolean;
}

const emptyDraft: Draft = { email: '', firstName: '', lastName: '', role: 'MANAGER', password: '', isActive: true };

export default function UsersPage() {
  return (
    <AuthGuard>
      <UsersInner />
    </AuthGuard>
  );
}

function UsersInner() {
  const { user } = useAuth();
  const canManage = roleIs(user?.role, 'SUPER_ADMIN', 'ADMIN');
  const { busy, run } = useAsyncAction();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchUsers();
    if (res.ok && res.data) setRows(res.data);
    else setError(res.error?.message ?? 'Ошибка запроса');
    setLoading(false);
  }, []);

  useEffect(() => {
    // Синхронизация с внешним API: загрузка списка при монтировании/смене фильтров
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const save = () => {
    if (!draft) return;
    if (!draft.email.trim() || !draft.firstName.trim() || !draft.lastName.trim()) {
      setError('Заполните email, имя и фамилию');
      return;
    }
    if (!draft.id && draft.password.length < 8) {
      setError('Пароль должен быть не короче 8 символов');
      return;
    }
    run(async () => {
      const res = draft.id
        ? await updateUser(draft.id, {
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            role: draft.role,
            isActive: draft.isActive,
            ...(draft.password ? { password: draft.password } : {}),
          })
        : await createUser({
            email: draft.email.trim(),
            password: draft.password,
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            role: draft.role,
          });
      if (res.ok) {
        setDraft(null);
        setError(null);
        await load();
      } else {
        setError(res.error?.message ?? 'Ошибка запроса');
      }
    });
  };

  const remove = () => {
    if (!deleteTarget) return;
    run(async () => {
      const res = await deleteUser(deleteTarget.id);
      if (res.ok) {
        setDeleteTarget(null);
        await load();
      } else {
        setError(res.error?.message ?? 'Ошибка запроса');
        setDeleteTarget(null);
      }
    });
  };

  return (
    <AdminShell title="Пользователи">
      <div className="space-y-4">
        {!canManage && <ErrorBanner message="У вашей роли нет доступа к управлению пользователями." />}
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {canManage && (
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setDraft({ ...emptyDraft });
                setError(null);
              }}
            >
              + Добавить сотрудника
            </Button>
          </div>
        )}

        {loading ? (
          <SkeletonRows rows={5} cols={4} />
        ) : rows.length === 0 ? (
          <EmptyState title="Пользователей нет" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Имя</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Роль</th>
                  <th className="px-4 py-2 font-medium">Статус</th>
                  {canManage && <th className="px-4 py-2 font-medium">Действия</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((u) => (
                  <tr key={u.id} className={!u.isActive ? 'opacity-50' : ''}>
                    <td className="px-4 py-2 font-medium">
                      {u.firstName} {u.lastName}
                      {u.id === user?.id && <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-700">вы</span>}
                    </td>
                    <td className="px-4 py-2 text-neutral-600">{u.email}</td>
                    <td className="px-4 py-2">{ROLE_LABELS[u.role]}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-500'}`}>
                        {u.isActive ? 'Активен' : 'Отключён'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setDraft({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, password: '', isActive: u.isActive });
                              setError(null);
                            }}
                          >
                            Ред.
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              run(async () => {
                                const res = await updateUser(u.id, { isActive: !u.isActive });
                                if (res.ok) await load();
                                else setError(res.error?.message ?? 'Ошибка запроса');
                              })
                            }
                            busy={busy}
                            disabled={u.id === user?.id}
                          >
                            {u.isActive ? 'Отключить' : 'Включить'}
                          </Button>
                          {u.id !== user?.id && (
                            <Button variant="danger" onClick={() => setDeleteTarget(u)}>
                              Удалить
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Модалка создания/редактирования */}
        {draft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Пользователь">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
              <h2 className="text-lg font-semibold">{draft.id ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h2>
              <div className="mt-4 space-y-3">
                <Field label="Email" hint={draft.id ? 'Email изменить нельзя' : undefined}>
                  <TextInput type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} disabled={!!draft.id} autoComplete="off" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Имя">
                    <TextInput value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} maxLength={100} />
                  </Field>
                  <Field label="Фамилия">
                    <TextInput value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} maxLength={100} />
                  </Field>
                </div>
                <Field label="Роль (§7)">
                  <Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={draft.id ? 'Новый пароль (пусто — не менять)' : 'Пароль'} hint="Минимум 8 символов">
                  <TextInput type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} autoComplete="new-password" />
                </Field>
                {draft.id && (
                  <Field label="Статус">
                    <Select value={draft.isActive ? '1' : '0'} onChange={(e) => setDraft({ ...draft, isActive: e.target.value === '1' })}>
                      <option value="1">Активен</option>
                      <option value="0">Отключён</option>
                    </Select>
                  </Field>
                )}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setDraft(null)} disabled={busy}>
                  Отмена
                </Button>
                <Button onClick={save} busy={busy}>
                  Сохранить
                </Button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!deleteTarget}
          title="Удалить сотрудника?"
          confirmLabel="Удалить"
          description={deleteTarget ? `«${deleteTarget.firstName} ${deleteTarget.lastName}» будет удалён. Его действия останутся в журнале.` : undefined}
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </AdminShell>
  );
}
