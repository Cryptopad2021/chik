"use client";

/**
 * Telegram-публикации (PHASE 10.5, ТЗ §33–34):
 * - редактор шаблона поста (переменные {{...}}, preview на реальном выезде, публикация);
 * - лента TelegramPost (PUBLICATION / CHANNEL_INGEST, статусы SENT/FAILED/DRAFT);
 * - ручной ingest поста из канала (§10.6).
 */
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { AuthGuard } from "@/components/AuthGuard";
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  Select,
  SkeletonRows,
  SuccessBanner,
  TextArea,
  TextInput,
  useAsyncAction,
} from "@/components/ui";
import {
  fetchDepartures,
  fetchSiteSettings,
  fetchTelegramPosts,
  fetchTelegramTemplateInfo,
  ingestTelegramPost,
  previewTelegramPost,
  publishTelegramPost,
  updateSiteSettings,
  type DepartureRow,
  type TelegramPostRow,
  type TelegramPreviewResult,
  type TelegramTemplateInfo,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { roleIs } from "@/lib/permissions";

export default function TelegramPage() {
  return (
    <AuthGuard>
      <TelegramInner />
    </AuthGuard>
  );
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Черновик",
  SENT: "Опубликован",
  FAILED: "Ошибка",
};

const SOURCE_LABEL: Record<string, string> = {
  PUBLICATION: "Публикация",
  CHANNEL_INGEST: "Канал (ingest)",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function TelegramInner() {
  const { user } = useAuth();
  const canPublish = roleIs(
    user?.role,
    "SUPER_ADMIN",
    "ADMIN",
    "CONTENT_MANAGER",
  );
  const { busy, run } = useAsyncAction();

  // --- шаблон ---
  const [info, setInfo] = useState<TelegramTemplateInfo | null>(null);
  const [template, setTemplate] = useState("");
  const [savedTemplate, setSavedTemplate] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);

  // --- preview/publish ---
  const [departures, setDepartures] = useState<DepartureRow[]>([]);
  const [departureId, setDepartureId] = useState("");
  const [preview, setPreview] = useState<TelegramPreviewResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);

  // --- лента ---
  const [posts, setPosts] = useState<TelegramPostRow[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);

  // --- ingest ---
  const [ingestText, setIngestText] = useState("");
  const [ingestChannel, setIngestChannel] = useState("");
  const [ingestMessageId, setIngestMessageId] = useState("");
  const [ingestOk, setIngestOk] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    const res = await fetchTelegramPosts(50);
    if (res.ok && res.data) setPosts(res.data);
    else setPostsError(res.error?.message ?? "Ошибка загрузки ленты");
    setPostsLoading(false);
  }, []);

  useEffect(() => {
    // Синхронизация с внешним API: загрузка при монтировании
    void (async () => {
      const [tpl, settings, deps] = await Promise.all([
        fetchTelegramTemplateInfo(),
        fetchSiteSettings(),
        fetchDepartures({ status: "OPEN" }),
      ]);
      if (tpl.ok && tpl.data) {
        setInfo(tpl.data);
        const saved = settings.ok
          ? (settings.data?.telegramPostTemplate ?? "")
          : "";
        const value = saved || tpl.data.defaultTemplate;
        setTemplate(value);
        setSavedTemplate(value);
      } else {
        setTemplateError(tpl.error?.message ?? "Не удалось загрузить шаблон");
      }
      if (deps.ok && deps.data) {
        setDepartures(deps.data);
        setDepartureId(deps.data[0]?.id ?? "");
      }
      await loadPosts();
    })();
  }, [loadPosts]);

  const dirty = template !== savedTemplate;

  const saveTemplate = () => {
    setActionOk(null);
    void run(async () => {
      const res = await updateSiteSettings({ telegramPostTemplate: template });
      if (res.ok && res.data) {
        setSavedTemplate(template);
        setActionOk("Шаблон сохранён");
        setTemplateError(null);
      } else {
        setTemplateError(res.error?.message ?? "Не удалось сохранить шаблон");
      }
    });
  };

  const doPreview = () => {
    if (!departureId) return;
    setActionOk(null);
    void run(async () => {
      const res = await previewTelegramPost(
        departureId,
        dirty ? template : null,
      );
      if (res.ok && res.data) {
        setPreview(res.data);
        setActionError(null);
      } else {
        setPreview(null);
        setActionError(res.error?.message ?? "Ошибка предпросмотра");
      }
    });
  };

  const doPublish = () => {
    if (!departureId) return;
    if (dirty) {
      setActionError(
        "Сначала сохраните изменённый шаблон (или отмените правки)",
      );
      return;
    }
    setActionOk(null);
    void run(async () => {
      const res = await publishTelegramPost(departureId);
      if (res.ok && res.data) {
        setActionOk(
          res.data.dryRun
            ? "Dry-run: пост сформирован без отправки (бот не настроен)"
            : "Пост опубликован в канал",
        );
        setActionError(null);
        await loadPosts();
      } else {
        setActionError(res.error?.message ?? "Ошибка публикации");
      }
    });
  };

  const doIngest = () => {
    if (!ingestText.trim()) {
      setActionError("Укажите текст поста из канала");
      return;
    }
    setIngestOk(null);
    void run(async () => {
      const res = await ingestTelegramPost({
        text: ingestText.trim(),
        channelUsername: ingestChannel.trim() || null,
        messageId: ingestMessageId.trim() || null,
      });
      if (res.ok && res.data) {
        if (res.data.ingested) {
          setIngestOk("Пост добавлен в ленту (ingest)");
          setIngestText("");
          setIngestChannel("");
          setIngestMessageId("");
          setActionError(null);
          await loadPosts();
        } else {
          setIngestOk(`Не добавлен: ${res.data.reason ?? "unknown"}`);
        }
      } else {
        setActionError(res.error?.message ?? "Ошибка ingest");
      }
    });
  };

  const insertVariable = (name: string) => {
    setTemplate((t) => (t ? `${t}{{${name}}}` : `{{${name}}}`));
  };

  return (
    <AdminShell title="Telegram">
      <div className="space-y-8">
        {templateError && (
          <ErrorBanner
            message={templateError}
            onDismiss={() => setTemplateError(null)}
          />
        )}
        {actionError && (
          <ErrorBanner
            message={actionError}
            onDismiss={() => setActionError(null)}
          />
        )}
        {actionOk && <SuccessBanner message={actionOk} />}
        {ingestOk && <SuccessBanner message={ingestOk} />}

        {/* Редактор шаблона + preview */}
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-1 text-base font-semibold text-neutral-900">
            Шаблон публикации
          </h2>
          <p className="mb-4 text-sm text-neutral-500">
            Переменные подставляются при публикации выезда в канал (ТЗ §33).
            Сохраняется в настройках сайта.
          </p>
          <Field
            label="Текст шаблона"
            hint={dirty ? "Есть несохранённые изменения" : undefined}
          >
            <TextArea
              rows={7}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              disabled={!canPublish}
            />
          </Field>
          {info && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {info.variables.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  title={v.description}
                  onClick={() => insertVariable(v.name)}
                  disabled={!canPublish}
                  className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-xs text-neutral-700 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                >
                  {`{{${v.name}}}`}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Field label="Выезд для предпросмотра/публикации">
                <Select
                  value={departureId}
                  onChange={(e) => setDepartureId(e.target.value)}
                >
                  {departures.length === 0 && (
                    <option value="">Нет открытых выездов</option>
                  )}
                  {departures.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.tour?.title ?? "Тур"} —{" "}
                      {new Date(d.startDate).toLocaleDateString("ru-RU")} (
                      {d.availableSeats} мест)
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button
              variant="secondary"
              onClick={doPreview}
              busy={busy}
              disabled={!departureId}
            >
              Предпросмотр
            </Button>
            {canPublish && (
              <>
                <Button onClick={saveTemplate} busy={busy} disabled={!dirty}>
                  Сохранить шаблон
                </Button>
                <Button
                  variant="secondary"
                  onClick={doPublish}
                  busy={busy}
                  disabled={!departureId}
                >
                  Опубликовать в канал
                </Button>
              </>
            )}
          </div>
          {preview && (
            <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
                <span>Канал: {preview.channel ?? "не задан"}</span>
                <span
                  className={
                    preview.sendEnabled ? "text-green-600" : "text-amber-600"
                  }
                >
                  {preview.sendEnabled
                    ? "отправка включена"
                    : "dry-run: бот не настроен"}
                </span>
              </div>
              {preview.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.photoUrl}
                  alt=""
                  className="mb-2 max-h-48 rounded object-cover"
                />
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-800">
                {preview.text}
              </pre>
            </div>
          )}
        </section>

        {/* Ручной ingest канала */}
        {canPublish && (
          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-1 text-base font-semibold text-neutral-900">
              Добавить пост из канала (ingest)
            </h2>
            <p className="mb-4 text-sm text-neutral-500">
              Контент из канала сохраняется в ленте как источник (ТЗ §10.6).
              Дедупликация по ID сообщения.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Канал (@username)">
                <TextInput
                  value={ingestChannel}
                  onChange={(e) => setIngestChannel(e.target.value)}
                  placeholder="@my_channel"
                />
              </Field>
              <Field label="ID сообщения (дедуп)">
                <TextInput
                  value={ingestMessageId}
                  onChange={(e) => setIngestMessageId(e.target.value)}
                  placeholder="123"
                  inputMode="numeric"
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Текст поста">
                <TextArea
                  rows={3}
                  value={ingestText}
                  onChange={(e) => setIngestText(e.target.value)}
                  placeholder="Текст публикации из канала…"
                />
              </Field>
            </div>
            <div className="mt-3">
              <Button variant="secondary" onClick={doIngest} busy={busy}>
                Добавить в ленту
              </Button>
            </div>
          </section>
        )}

        {/* Лента постов */}
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900">
              Лента публикаций
            </h2>
            <Button
              variant="ghost"
              onClick={() => void loadPosts()}
              disabled={postsLoading}
            >
              Обновить
            </Button>
          </div>
          {postsError && (
            <ErrorBanner
              message={postsError}
              onDismiss={() => setPostsError(null)}
            />
          )}
          {postsLoading ? (
            <SkeletonRows rows={4} cols={4} />
          ) : posts.length === 0 ? (
            <EmptyState
              title="Постов пока нет"
              description="Опубликуйте выезд или добавьте пост из канала."
            />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {posts.map((p) => (
                <li key={p.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span
                      className={
                        "rounded px-1.5 py-0.5 font-medium " +
                        (p.status === "SENT"
                          ? "bg-green-50 text-green-700"
                          : p.status === "FAILED"
                            ? "bg-red-50 text-red-700"
                            : "bg-neutral-100 text-neutral-600")
                      }
                    >
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                      {SOURCE_LABEL[p.source] ?? p.source}
                    </span>
                    {p.channelUsername && <span>{p.channelUsername}</span>}
                    {p.tour && <span>{p.tour.title}</span>}
                    <span className="ml-auto">
                      {fmtDate(p.publishedAt ?? p.createdAt)}
                    </span>
                  </div>
                  <pre className="mt-2 line-clamp-3 whitespace-pre-wrap font-sans text-sm text-neutral-800">
                    {p.text}
                  </pre>
                  {p.error && (
                    <p className="mt-1 text-xs text-red-600">
                      Ошибка: {p.error}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
