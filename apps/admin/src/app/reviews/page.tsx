'use client';

/**
 * Модерация отзывов (PHASE 9.8, ТЗ §34): очередь PENDING, одобрение/отклонение
 * с комментарием модератора, фильтры по статусу.
 */
import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { AuthGuard } from '@/components/AuthGuard';
import { Button, EmptyState, ErrorBanner, Field, Select, SkeletonRows, TextArea, useAsyncAction } from '@/components/ui';
import { fetchReviewsAdmin, moderateReview, type ReviewRow, type ReviewStatusValue } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { roleIs } from '@/lib/permissions';

const STATUS_LABELS: Record<ReviewStatusValue, string> = {
  PENDING: 'На модерации',
  APPROVED: 'Опубликован',
  REJECTED: 'Отклонён',
};

const STATUS_COLORS: Record<ReviewStatusValue, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-700',
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-sm text-amber-500" aria-label={`Оценка ${rating} из 5`}>
      {'★'.repeat(rating)}
      <span className="text-neutral-300">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

export default function ReviewsPage() {
  return (
    <AuthGuard>
      <ReviewsInner />
    </AuthGuard>
  );
}

function ReviewsInner() {
  const { user } = useAuth();
  const canModerate = roleIs(user?.role, 'SUPER_ADMIN', 'ADMIN', 'MANAGER');
  const { busy, run } = useAsyncAction();

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewStatusValue | ''>('PENDING');
  const [noteFor, setNoteFor] = useState<{ id: string; action: 'APPROVED' | 'REJECTED' } | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchReviewsAdmin(statusFilter || undefined);
    if (res.ok && res.data) setRows(res.data);
    else setError(res.error?.message ?? 'Ошибка запроса');
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    // Синхронизация с внешним API: загрузка списка при монтировании/смене фильтров
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const applyModeration = () => {
    if (!noteFor) return;
    run(async () => {
      const res = await moderateReview(noteFor.id, noteFor.action, note.trim() || undefined);
      if (res.ok) {
        setNoteFor(null);
        setNote('');
        setError(null);
        await load();
      } else {
        setError(res.error?.message ?? 'Ошибка запроса');
      }
    });
  };

  const quickApprove = (id: string) => {
    run(async () => {
      const res = await moderateReview(id, 'APPROVED');
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: res.data?.status ?? "APPROVED" } : r)));
        if (statusFilter === 'PENDING') setRows((prev) => prev.filter((r) => r.id !== id));
      } else setError(res.error?.message ?? 'Ошибка запроса');
    });
  };

  return (
    <AdminShell title="Отзывы">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="flex flex-wrap items-center gap-3">
          <Field label="Статус">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ReviewStatusValue | '')}>
              <option value="">Все</option>
              <option value="PENDING">На модерации</option>
              <option value="APPROVED">Опубликованные</option>
              <option value="REJECTED">Отклонённые</option>
            </Select>
          </Field>
        </div>

        {loading ? (
          <SkeletonRows rows={5} cols={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={statusFilter ? 'Нет отзывов с таким статусом' : 'Отзывов пока нет'}
            description="Отзывы клиентов появятся здесь после отправки формы на сайте."
          />
        ) : (
          <ul className="space-y-3" role="list">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Stars rating={r.rating} />
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {r.authorName || 'Аноним'} {r.tour ? <span className="text-neutral-500">· {r.tour.title}</span> : null}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">{r.text}</p>
                    <p className="mt-1 text-xs text-neutral-400">{new Date(r.createdAt).toLocaleString('ru-RU')}</p>
                  </div>
                  {canModerate && r.status === 'PENDING' && (
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button onClick={() => quickApprove(r.id)} busy={busy}>
                        Одобрить
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          setNoteFor({ id: r.id, action: 'REJECTED' });
                          setNote('');
                        }}
                        disabled={!!noteFor}
                      >
                        Отклонить
                      </Button>
                    </div>
                  )}
                  {canModerate && r.status !== 'PENDING' && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setNoteFor({ id: r.id, action: r.status === 'APPROVED' ? 'REJECTED' : 'APPROVED' });
                        setNote('');
                      }}
                      disabled={!!noteFor}
                    >
                      {r.status === 'APPROVED' ? 'Снять с публикации' : 'Вернуть в публикацию'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Диалог с комментарием модератора */}
        {noteFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Комментарий модератора">
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
              <h2 className="text-lg font-semibold">{noteFor.action === 'REJECTED' ? 'Отклонить отзыв?' : 'Одобрить отзыв?'}</h2>
              <div className="mt-3">
                <Field label="Комментарий (необязательно)" hint="Виден только в журнале действий (§38)">
                  <TextArea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Причина отклонения / заметка" />
                </Field>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setNoteFor(null)} disabled={busy}>
                  Отмена
                </Button>
                <Button variant={noteFor.action === 'REJECTED' ? 'danger' : 'primary'} onClick={applyModeration} busy={busy}>
                  {noteFor.action === 'REJECTED' ? 'Отклонить' : 'Одобрить'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
