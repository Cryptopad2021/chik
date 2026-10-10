'use client';

/**
 * FAQ (PHASE 9.8, ТЗ §35): список вопросов с категориями, создание/редактирование,
 * публикация, сортировка, удаление с подтверждением.
 */
import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { AuthGuard } from '@/components/AuthGuard';
import { Button, ConfirmDialog, EmptyState, ErrorBanner, Field, Select, SkeletonRows, TextArea, TextInput, useAsyncAction } from '@/components/ui';
import { createFaq, deleteFaq, fetchFaqAll, updateFaq, type FaqRow } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { roleIs } from '@/lib/permissions';

interface Draft {
  id?: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
}

const emptyDraft: Draft = { question: '', answer: '', category: '', sortOrder: 0, isPublished: true };

export default function FaqPage() {
  return (
    <AuthGuard>
      <FaqInner />
    </AuthGuard>
  );
}

function FaqInner() {
  const { user } = useAuth();
  const canEdit = roleIs(user?.role, 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CONTENT_MANAGER');
  const { busy, run } = useAsyncAction();

  const [rows, setRows] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FaqRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchFaqAll();
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
    if (!draft.question.trim() || !draft.answer.trim()) {
      setError('Вопрос и ответ обязательны');
      return;
    }
    run(async () => {
      const body = {
        question: draft.question.trim(),
        answer: draft.answer.trim(),
        category: draft.category.trim() || undefined,
        sortOrder: draft.sortOrder,
        isPublished: draft.isPublished,
      };
      const res = draft.id ? await updateFaq(draft.id, body) : await createFaq(body);
      if (res.ok) {
        setDraft(null);
        setError(null);
        await load();
      } else {
        setError(res.error?.message ?? 'Ошибка запроса');
      }
    });
  };

  const togglePublish = (row: FaqRow) => {
    run(async () => {
      const res = await updateFaq(row.id, { isPublished: !row.isPublished });
      if (res.ok) setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isPublished: res.data?.isPublished ?? !row.isPublished } : r)));
      else setError(res.error?.message ?? 'Ошибка запроса');
    });
  };

  const remove = () => {
    if (!deleteTarget) return;
    run(async () => {
      const res = await deleteFaq(deleteTarget.id);
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else setError(res.error?.message ?? 'Ошибка запроса');
    });
  };

  return (
    <AdminShell title="Частые вопросы (FAQ)">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {canEdit && (
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setDraft({ ...emptyDraft, sortOrder: rows.length + 1 });
                setError(null);
              }}
            >
              + Добавить вопрос
            </Button>
          </div>
        )}

        {loading ? (
          <SkeletonRows rows={6} cols={3} />
        ) : rows.length === 0 ? (
          <EmptyState title="Вопросов пока нет" description="Добавьте частые вопросы — они появятся на странице тура и в блоке FAQ." />
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white" role="list">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.question} {!r.isPublished && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">черновик</span>}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{r.answer}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {r.category ? `Категория: ${r.category} · ` : ''}порядок: {r.sortOrder}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" onClick={() => togglePublish(r)} busy={busy}>
                      {r.isPublished ? 'Снять с публикации' : 'Опубликовать'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setDraft({ id: r.id, question: r.question, answer: r.answer, category: r.category ?? '', sortOrder: r.sortOrder, isPublished: r.isPublished });
                        setError(null);
                      }}
                    >
                      Ред.
                    </Button>
                    <Button variant="danger" onClick={() => setDeleteTarget(r)}>
                      Удалить
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Модалка создания/редактирования */}
        {draft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Вопрос FAQ">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
              <h2 className="text-lg font-semibold">{draft.id ? 'Редактировать вопрос' : 'Новый вопрос'}</h2>
              <div className="mt-4 space-y-3">
                <Field label="Вопрос">
                  <TextInput value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} maxLength={300} />
                </Field>
                <Field label="Ответ">
                  <TextArea rows={5} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} maxLength={3000} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Категория" hint="Напр.: Бронирование, Оплата">
                    <TextInput value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} maxLength={100} />
                  </Field>
                  <Field label="Порядок">
                    <TextInput type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })} />
                  </Field>
                </div>
                <Field label="Статус">
                  <Select value={draft.isPublished ? '1' : '0'} onChange={(e) => setDraft({ ...draft, isPublished: e.target.value === '1' })}>
                    <option value="1">Опубликован</option>
                    <option value="0">Черновик</option>
                  </Select>
                </Field>
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
          title="Удалить вопрос?"
          description={deleteTarget ? `«${deleteTarget.question}» будет удалён с сайта.` : undefined}
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </AdminShell>
  );
}
