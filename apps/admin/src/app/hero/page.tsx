'use client';

/**
 * Управление hero-каруселью главной страницы (фото + описание слайдов,
 * порядок, вкл/выкл). Клик по слайду на сайте ведёт на первый опубликованный
 * тур направления. Данные — через API destinations/:id/hero (tour:write).
 */
import { useEffect, useRef, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import {
  fetchDestinations,
  fetchHeroSettings,
  updateHeroSettings,
  uploadMedia,
  type DestinationRow,
  type HeroSettings,
} from '@/lib/api';

interface SlideState {
  id: string;
  name: string;
  showInHero: boolean;
  heroSortOrder: number;
  title: string;
  text: string;
  imageUrl: string | null;
  tourSlug: string | null;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
}

export default function HeroCarouselAdminPage() {
  const [slides, setSlides] = useState<SlideState[]>([]);
  const [initializing, setInitializing] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // загрузка один раз при монтировании (не через useEffect-setState, чтобы
  // не нарушать react-hooks/set-state-in-effect: инициация в event/обёртке)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchDestinations();
      if (cancelled) return;
      if (!res.ok || !Array.isArray(res.data)) {
        setError(res.error?.message ?? 'Не удалось загрузить направления');
        setInitializing(false);
        return;
      }
      const rows: DestinationRow[] = res.data;
      const items: SlideState[] = rows.map((d) => ({
        id: d.id,
        name: d.name,
        showInHero: d.showInHero ?? false,
        heroSortOrder: d.heroSortOrder ?? 0,
        title: '',
        text: '',
        imageUrl: null,
        tourSlug: null,
        dirty: false,
        loading: true,
        saving: false,
      }));
      setSlides(items);
      setInitializing(false);
      // подтягиваем эффективные значения каждого слайда
      for (const it of items) {
        const h = await fetchHeroSettings(it.id);
        if (cancelled) return;
        if (h.ok && h.data) {
          const data: HeroSettings = h.data;
          setSlides((prev) =>
            prev.map((s) =>
              s.id === it.id
                ? {
                    ...s,
                    title: data.title,
                    text: data.text,
                    imageUrl: data.imageUrl,
                    tourSlug: data.tourSlug,
                    showInHero: data.showInHero,
                    heroSortOrder: data.heroSortOrder,
                    loading: false,
                  }
                : s,
            ),
          );
        } else {
          setSlides((prev) => prev.map((s) => (s.id === it.id ? { ...s, loading: false } : s)));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchSlide = (id: string, patch: Partial<SlideState>) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch, dirty: true } : s)),
    );
  };

  const saveSlide = async (s: SlideState) => {
    setSlides((prev) => prev.map((x) => (x.id === s.id ? { ...x, saving: true } : x)));
    setError(null);
    setMessage(null);
    const res = await updateHeroSettings(s.id, {
      title: s.title || null,
      text: s.text || null,
      imageUrl: s.imageUrl || null,
      showInHero: s.showInHero,
      heroSortOrder: s.heroSortOrder,
    });
    setSlides((prev) =>
      prev.map((x) =>
        x.id === s.id ? { ...x, saving: false, dirty: res.ok ? false : x.dirty } : x,
      ),
    );
    if (res.ok) {
      setMessage(`Слайд «${s.name}» сохранён`);
    } else {
      setError(res.error?.message ?? 'Ошибка сохранения');
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    setSlides((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      // переоцениваем порядковые номера по позиции
      return next.map((s, i) => ({ ...s, heroSortOrder: i, dirty: true }));
    });
  };

  return (
    <AdminShell title="Главная: карусель туров">
      <p className="mb-4 text-sm text-neutral-600">
        Слайды формируются из направлений. Включите «Показывать», задайте фото и
        текст — клик по слайду на сайте ведёт на первый опубликованный тур
        направления. Порядок меняется стрелками ↑/↓ и сохраняется кнопкой.
      </p>

      {message && (
        <div className="mb-3 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {initializing ? (
        <div className="text-neutral-500">Загрузка…</div>
      ) : slides.length === 0 ? (
        <div className="text-neutral-500">Направлений нет — сначала создайте их в разделе «Туры».</div>
      ) : (
        <ul className="space-y-4">
          {slides.map((s, i) => (
            <li
              key={s.id}
              className={`rounded-lg border bg-white p-4 shadow-sm ${
                s.showInHero ? 'border-emerald-300' : 'border-neutral-200'
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-xs text-neutral-600">
                    {i + 1}
                  </span>
                  {s.name}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded border border-neutral-200 px-2 py-1 text-sm disabled:opacity-30"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Вверх"
                    title="Выше в карусели"
                  >
                    ↑
                  </button>
                  <button
                    className="rounded border border-neutral-200 px-2 py-1 text-sm disabled:opacity-30"
                    onClick={() => move(i, 1)}
                    disabled={i === slides.length - 1}
                    aria-label="Вниз"
                    title="Ниже в карусели"
                  >
                    ↓
                  </button>
                </div>
              </div>

              {s.loading ? (
                <div className="text-sm text-neutral-500">Загрузка настроек…</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
                  <div>
                    <ImageField
                      value={s.imageUrl}
                      onChange={(url) => patchSlide(s.id, { imageUrl: url })}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm">
                      <span className="mb-1 block text-neutral-700">Заголовок слайда</span>
                      <input
                        className="w-full rounded border border-neutral-300 px-2 py-1"
                        value={s.title}
                        maxLength={200}
                        onChange={(e) => patchSlide(s.id, { title: e.target.value })}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-neutral-700">Описание</span>
                      <textarea
                        className="w-full rounded border border-neutral-300 px-2 py-1"
                        rows={3}
                        maxLength={500}
                        value={s.text}
                        onChange={(e) => patchSlide(s.id, { text: e.target.value })}
                      />
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={s.showInHero}
                          onChange={(e) => patchSlide(s.id, { showInHero: e.target.checked })}
                        />
                        Показывать в карусели
                      </label>
                      {s.tourSlug ? (
                        <span className="text-xs text-neutral-500">
                          Клик → тур <code>/tours/{s.tourSlug}</code>
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600">
                          Нет опубликованного тура — клик ведёт на страницу направления
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <button
                        className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!s.dirty || s.saving}
                        onClick={() => void saveSlide(s)}
                      >
                        {s.saving ? 'Сохранение…' : s.dirty ? 'Сохранить' : 'Сохранено'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

/** Фото слайда: превью + загрузка через POST /api/media/upload. */
function ImageField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onPick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    const res = await uploadMedia(file);
    setBusy(false);
    if (res.ok && res.data?.url) onChange(res.data.url);
    else setErr(res.error?.message ?? 'Ошибка загрузки файла');
  };

  return (
    <div>
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded border border-neutral-200 bg-neutral-100">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-400">
            Фото не задано
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Загрузка…' : 'Загрузить фото'}
        </button>
        {value && (
          <button
            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600"
            onClick={() => onChange(null)}
          >
            Сбросить
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
