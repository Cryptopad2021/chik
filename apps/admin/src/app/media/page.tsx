'use client';

/**
 * Медиабиблиотека (PHASE 9.7, ТЗ §41): загрузка изображений, сетка файлов,
 * alt-тексты (SEO), удаление с подтверждением (§66).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { AuthGuard } from '@/components/AuthGuard';
import { ConfirmDialog, EmptyState, ErrorBanner, SkeletonRows, Button, Field, TextInput, useAsyncAction, Pagination } from '@/components/ui';
import { deleteMedia, fetchMediaLibrary, setMediaAlt, uploadMedia, type MediaFile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { roleIs } from '@/lib/permissions';

const PER_PAGE = 24;

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} МБ`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${bytes} Б`;
}

export default function MediaPage() {
  return (
    <AuthGuard>
      <MediaInner />
    </AuthGuard>
  );
}

function MediaInner() {
  const { user } = useAuth();
  const canEdit = roleIs(user?.role, 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CONTENT_MANAGER');
  const { busy, run } = useAsyncAction();
  const fileRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<MediaFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [altTarget, setAltTarget] = useState<MediaFile | null>(null);
  const [altValue, setAltValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const load = useCallback(async (p: number) => {
    const res = await fetchMediaLibrary(p, PER_PAGE);
    if (res.ok && res.data) {
      setItems(res.data.items);
      setTotal(res.data.total);
      setError(null);
    } else {
      setError(res.error?.message ?? 'Ошибка запроса');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Асинхронная загрузка: setState происходит только после await (не синхронно в теле эффекта)
    void Promise.resolve().then(() => load(page));
  }, [load, page]);

  const onUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    run(async () => {
      let ok = 0;
      let lastErr = '';
      for (const f of Array.from(files)) {
        const res = await uploadMedia(f);
        if (res.ok) ok += 1;
        else lastErr = res.error?.message ?? 'Ошибка загрузки';
      }
      if (ok > 0) {
        setNotice(`Загружено файлов: ${ok}`);
        setPage(1);
        await load(1);
      }
      if (lastErr) setError(lastErr);
    });
  };

  const saveAlt = () => {
    if (!altTarget) return;
    run(async () => {
      const res = await setMediaAlt(altTarget.id, altValue.trim() || null);
      if (res.ok && res.data) {
        setItems((prev) => prev.map((m) => (m.id === res.data!.id ? { ...m, alt: res.data!.alt ?? null } : m)));
        setAltTarget(null);
        setNotice('Alt-текст сохранён');
      } else {
        setError(res.error?.message ?? 'Ошибка запроса');
      }
    });
  };

  const removeFile = () => {
    if (!deleteTarget) return;
    run(async () => {
      const res = await deleteMedia(deleteTarget.id);
      if (res.ok) {
        setDeleteTarget(null);
        setNotice('Файл удалён');
        await load(page);
      } else {
        setError(res.error?.message ?? 'Ошибка запроса');
        setDeleteTarget(null);
      }
    });
  };

  return (
    <AdminShell title="Медиабиблиотека">
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {notice && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</div>}

        {canEdit && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                onUpload(e.target.files);
                e.target.value = '';
              }}
            />
            <Button onClick={() => fileRef.current?.click()} busy={busy}>
              ⬆ Загрузить изображения
            </Button>
            <span className="text-xs text-neutral-500">JPEG / PNG / WebP / GIF, до 10 МБ каждый (§41)</span>
          </div>
        )}

        {loading ? (
          <SkeletonRows rows={6} cols={4} />
        ) : items.length === 0 ? (
          <EmptyState title="Файлов пока нет" description="Загрузите изображения — они появятся здесь и будут доступны в галереях туров." />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" role="list">
              {items.map((m) => (
                <li key={m.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.alt ?? m.filename} loading="lazy" className="aspect-square w-full object-cover" />
                  <div className="space-y-1 p-2">
                    <p className="truncate text-xs font-medium" title={m.filename}>
                      {m.filename}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {m.width && m.height ? `${m.width}×${m.height}, ` : ''}
                      {formatSize(m.size)}
                    </p>
                    {m.alt ? <p className="line-clamp-2 text-[11px] text-brand-700" title={m.alt}>alt: {m.alt}</p> : <p className="text-[11px] italic text-neutral-400">без alt</p>}
                    {canEdit && (
                      <div className="flex gap-1 pt-1">
                        <button
                          type="button"
                          className="rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] hover:bg-neutral-50"
                          onClick={() => {
                            setAltTarget(m);
                            setAltValue(m.alt ?? '');
                          }}
                        >
                          Alt
                        </button>
                        <button
                          type="button"
                          className="rounded border border-red-200 px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(m)}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}

        {/* Диалог alt-текста */}
        {altTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Alt-текст">
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
              <h2 className="text-lg font-semibold">Alt-текст изображения</h2>
              <p className="mt-1 truncate text-xs text-neutral-500">{altTarget.filename}</p>
              <div className="mt-3">
                <Field label="Описание для поисковиков и скринридеров (§30)">
                  <TextInput value={altValue} onChange={(e) => setAltValue(e.target.value)} placeholder="Напр.: Горный пейзаль Ала Арча, Кыргызстан" maxLength={200} />
                </Field>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setAltTarget(null)} disabled={busy}>
                  Отмена
                </Button>
                <Button onClick={saveAlt} busy={busy}>
                  Сохранить
                </Button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!deleteTarget}
          title="Удалить файл?"
          description={deleteTarget ? `Файл «${deleteTarget.filename}» будет удалён безвозвратно. Если он используется в турах, изображения могут перестать отображаться.` : undefined}
          busy={busy}
          onConfirm={removeFile}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </AdminShell>
  );
}
