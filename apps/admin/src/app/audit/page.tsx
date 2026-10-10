'use client';

/**
 * Журнал действий (PHASE 9.9, ТЗ §38): кто, что, когда изменил + IP.
 * Только чтение, доступ SUPER_ADMIN/ADMIN.
 */
import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { AuthGuard } from '@/components/AuthGuard';
import { EmptyState, ErrorBanner, Select, SkeletonRows, TextInput } from '@/components/ui';
import { fetchAuditLog, type AuditRow } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { roleIs } from '@/lib/permissions';

const ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN: 'Вход',
  AUTH_LOGOUT: 'Выход',
  AUTH_REFRESH_REUSE: 'Переиспользование refresh-токена',
  TOUR_CREATED: 'Тур создан',
  TOUR_UPDATED: 'Тур обновлён',
  TOUR_ARCHIVED: 'Тур архивирован',
  TOUR_DAYS_REPLACED: 'Программа тура изменена',
  TOUR_IMAGES_REPLACED: 'Галерея тура изменена',
  DEPARTURE_CREATED: 'Выезд создан',
  DEPARTURE_UPDATED: 'Выезд обновлён',
  DEPARTURE_DELETED: 'Выезд удалён',
  BOOKING_STATUS_CHANGED: 'Статус заявки изменён',
  BOOKING_COMMENT_ADDED: 'Комментарий к заявке',
  BOOKING_MANAGER_ASSIGNED: 'Назначен менеджер',
  MEDIA_UPLOADED: 'Файл загружен',
  MEDIA_DELETED: 'Файл удалён',
  SETTINGS_UPDATED: 'Настройки изменены',
  USER_CREATED: 'Пользователь создан',
  USER_UPDATED: 'Пользователь обновлён',
  USER_DELETED: 'Пользователь удалён',
};

function actionLabel(a: string): string {
  return ACTION_LABELS[a] ?? a;
}

export default function AuditPage() {
  return (
    <AuthGuard>
      <AuditInner />
    </AuthGuard>
  );
}

function AuditInner() {
  const { user } = useAuth();
  const allowed = roleIs(user?.role, 'SUPER_ADMIN', 'ADMIN');

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const res = await fetchAuditLog(limit);
    if (res.ok && res.data) setRows(res.data);
    else setError(res.error?.message ?? 'Ошибка запроса');
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    // setState только после await (не синхронно в теле эффекта)
    void Promise.resolve().then(() => (allowed ? load() : (() => { setLoading(false); })()));
  }, [allowed, load]);

  const filtered = q
    ? rows.filter((r) => {
        const who = r.user ? `${r.user.firstName} ${r.user.lastName} ${r.user.email}` : '';
        return `${r.action} ${r.entity} ${r.entityId ?? ''} ${who} ${JSON.stringify(r.metadata ?? '')}`.toLowerCase().includes(q.toLowerCase());
      })
    : rows;

  if (!allowed) {
    return (
      <AdminShell title="Журнал действий">
        <ErrorBanner message="Журнал доступен только администраторам." />
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Журнал действий">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-sm font-medium text-neutral-700">Поиск</label>
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Действие, сущность, пользователь…" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Записей</label>
            <Select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="300">300</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <SkeletonRows rows={8} cols={4} />
        ) : filtered.length === 0 ? (
          <EmptyState title="Записей нет" description="Действия сотрудников появятся здесь автоматически (§38)." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Время</th>
                  <th className="px-4 py-2 font-medium">Пользователь</th>
                  <th className="px-4 py-2 font-medium">Действие</th>
                  <th className="px-4 py-2 font-medium">Сущность</th>
                  <th className="px-4 py-2 font-medium">IP</th>
                  <th className="px-4 py-2 font-medium">Детали</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-neutral-600">{new Date(r.createdAt).toLocaleString('ru-RU')}</td>
                    <td className="px-4 py-2">
                      {r.user ? (
                        <span>
                          {r.user.firstName} {r.user.lastName} <span className="text-xs text-neutral-400">({r.user.role})</span>
                        </span>
                      ) : (
                        <span className="text-xs italic text-neutral-400">система</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium">{actionLabel(r.action)}</td>
                    <td className="px-4 py-2 text-neutral-600">
                      {r.entity}
                      {r.entityId ? <span className="ml-1 text-xs text-neutral-400">#{r.entityId.slice(0, 8)}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-500">{r.ip ?? '—'}</td>
                    <td className="max-w-[280px] truncate px-4 py-2 text-xs text-neutral-500" title={r.metadata ? JSON.stringify(r.metadata) : ''}>
                      {r.metadata ? JSON.stringify(r.metadata) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
