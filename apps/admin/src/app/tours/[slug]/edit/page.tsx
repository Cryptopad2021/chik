'use client';

/**
 * Форма тура: создание и редактирование (PHASE 9.4, ТЗ §20).
 * Одно поле-компонент на /tours/new и /tours/[slug]/edit — различие только
 * в загрузке существующих данных по slug. Программа (дни) и галерея
 * сохраняются отдельными PUT-запросами (§9, §10). Публикация — сменой статуса.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { Button, ErrorBanner, Field, Select, SkeletonRows, SuccessBanner, TextArea, TextInput } from '@/components/ui';
import {
  createTour,
  fetchDestinations,
  fetchTour,
  replaceTourDays,
  replaceTourImages,
  updateTour,
  uploadMedia,
  type DestinationRow,
  type TourStatus,
} from '@/lib/api';

interface DayForm {
  dayNumber: number;
  title: string;
  description: string;
  meals: string;
  overnight: boolean;
}

interface ImageForm {
  url: string;
  alt: string;
  isCover: boolean;
}

const emptyTour = {
  title: '',
  shortDescription: '',
  description: '',
  destinationId: '',
  durationDays: 1,
  durationNights: 0,
  basePrice: 0,
  adultPrice: 0,
  child10to14Price: 0,
  childUnder10Price: 0,
  includedText: '',
  notIncludedText: '',
  metaTitle: '',
  metaDescription: '',
  status: 'DRAFT' as TourStatus,
};

export default function TourEditPage() {
  const params = useParams<{ slug?: string }>();
  const slug = params?.slug;
  const isNew = !slug || slug === 'new';
  const router = useRouter();

  const [loading, setLoading] = useState(!isNew);
  const [tourId, setTourId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyTour });
  const [days, setDays] = useState<DayForm[]>([]);
  const [images, setImages] = useState<ImageForm[]>([]);
  const [destinations, setDestinations] = useState<DestinationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const set = <K extends keyof typeof emptyTour>(key: K, value: (typeof emptyTour)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Загрузка направлений + (для edit) тура
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const destRes = await fetchDestinations();
      if (cancelled) return;
      if (destRes.ok && Array.isArray(destRes.data)) setDestinations(destRes.data);

      if (!isNew) {
        const res = await fetchTour(slug as string);
        if (cancelled) return;
        if (res.ok && res.data) {
          const t = res.data;
          setTourId(t.id);
          setForm({
            title: t.title,
            shortDescription: t.shortDescription,
            description: t.description ?? '',
            destinationId: t.destinationId,
            durationDays: t.durationDays,
            durationNights: t.durationNights,
            basePrice: Number(t.basePrice),
            adultPrice: Number(t.adultPrice ?? t.basePrice),
            child10to14Price: Number(t.child10to14Price ?? 0),
            childUnder10Price: Number(t.childUnder10Price ?? 0),
            includedText: t.includedText ?? '',
            notIncludedText: t.notIncludedText ?? '',
            metaTitle: t.metaTitle ?? '',
            metaDescription: t.metaDescription ?? '',
            status: t.status,
          });
          setDays(
            (t.days ?? []).map((d) => ({
              dayNumber: d.dayNumber,
              title: d.title,
              description: d.description,
              meals: d.meals ?? '',
              overnight: !!d.overnight,
            })),
          );
          setImages(
            (t.images ?? []).map((i) => ({ url: i.url, alt: i.alt, isCover: !!i.isCover })),
          );
        } else {
          setError(res.error?.message ?? 'Тур не найден');
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNew, slug]);

  /* ===== Сохранение основного объекта ===== */
  async function saveBasics(): Promise<string | null> {
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      shortDescription: form.shortDescription.trim(),
      description: form.description,
      destinationId: form.destinationId,
      durationDays: Number(form.durationDays),
      durationNights: Number(form.durationNights),
      basePrice: Number(form.basePrice),
      adultPrice: Number(form.adultPrice),
      child10to14Price: Number(form.child10to14Price),
      childUnder10Price: Number(form.childUnder10Price),
      status: form.status,
      ...(form.includedText ? { includedText: form.includedText } : {}),
      ...(form.notIncludedText ? { notIncludedText: form.notIncludedText } : {}),
      ...(form.metaTitle ? { metaTitle: form.metaTitle } : {}),
      ...(form.metaDescription ? { metaDescription: form.metaDescription } : {}),
    };
    if (isNew) {
      const res = await createTour(payload);
      if (!res.ok || !res.data) throw new Error(res.error?.message ?? 'Не удалось создать тур');
      setTourId(res.data.id);
      router.replace(`/tours/${res.data.slug}/edit`);
      return res.data.id;
    }
    if (!tourId) throw new Error('Тур не загружен');
    const res = await updateTour(tourId, payload);
    if (!res.ok) throw new Error(res.error?.message ?? 'Не удалось сохранить тур');
    return tourId;
  }

  async function onSave(withSections: boolean) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const id = await saveBasics();
      if (withSections && id) {
        const normDays = days.map((d, i) => ({ ...d, dayNumber: i + 1 }));
        if (normDays.length) {
          const r = await replaceTourDays(id, normDays);
          if (!r.ok) throw new Error(r.error?.message ?? 'Не удалось сохранить программу');
        }
        if (images.length) {
          const imgs = images.map((im, i) => ({ url: im.url, alt: im.alt || form.title, sortOrder: i, isCover: im.isCover || i === 0 }));
          const r = await replaceTourImages(id, imgs);
          if (!r.ok) throw new Error(r.error?.message ?? 'Не удалось сохранить галерею');
        }
      }
      setSaved('Сохранено');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setBusy(false);
    }
  }

  /* ===== Дни программы ===== */
  const addDay = () => setDays((d) => [...d, { dayNumber: d.length + 1, title: '', description: '', meals: '', overnight: false }]);
  const patchDay = (i: number, patch: Partial<DayForm>) => setDays((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const removeDay = (i: number) => setDays((ds) => ds.filter((_, j) => j !== i));
  const moveDay = (i: number, dir: -1 | 1) =>
    setDays((ds) => {
      const j = i + dir;
      if (j < 0 || j >= ds.length) return ds;
      const copy = [...ds];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  /* ===== Галерея ===== */
  const addImageSlot = () => setImages((im) => [...im, { url: '', alt: '', isCover: false }]);
  const patchImage = (i: number, patch: Partial<ImageForm>) => setImages((ims) => ims.map((im, j) => (j === i ? { ...im, ...patch } : im)));
  const removeImage = (i: number) => setImages((ims) => ims.filter((_, j) => j !== i));
  const moveImage = (i: number, dir: -1 | 1) =>
    setImages((ims) => {
      const j = i + dir;
      if (j < 0 || j >= ims.length) return ims;
      const copy = [...ims];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const onFilePicked = useCallback(async (i: number, file: File | undefined) => {
    if (!file) return;
    setUploadingIdx(i);
    setError(null);
    const res = await uploadMedia(file);
    setUploadingIdx(null);
    if (res.ok && res.data) {
      patchImage(i, { url: res.data.url, alt: res.data.filename });
    } else {
      setError(res.error?.message ?? 'Не удалось загрузить фото');
    }
  }, []);

  if (loading) {
    return (
      <AdminShell title="Тур">
        <SkeletonRows rows={8} cols={2} />
      </AdminShell>
    );
  }

  return (
    <AdminShell title={isNew ? 'Новый тур' : `Тур: ${form.title}`}>
      <div className="space-y-6 pb-24">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {saved && <SuccessBanner message={saved} />}

        {/* Основное */}
        <section className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-5 md:grid-cols-2">
          <Field label="Название *">
            <TextInput value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} />
          </Field>
          <Field label="Направление *">
            <Select value={form.destinationId} onChange={(e) => set('destinationId', e.target.value)}>
              <option value="">— выберите —</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Краткое описание *" hint="Карточка в каталоге, до 500 символов">
            <TextArea value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} maxLength={500} />
          </Field>
          <Field label="Полное описание">
            <TextArea rows={6} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="Дней *"><TextInput type="number" min={1} value={form.durationDays} onChange={(e) => set('durationDays', Number(e.target.value))} /></Field>
          <Field label="Ночей *"><TextInput type="number" min={0} value={form.durationNights} onChange={(e) => set('durationNights', Number(e.target.value))} /></Field>
          <Field label="Статус">
            <Select value={form.status} onChange={(e) => set('status', e.target.value as TourStatus)}>
              <option value="DRAFT">Черновик (не виден на сайте)</option>
              <option value="PUBLISHED">Опубликован</option>
              <option value="ARCHIVED">Архив</option>
            </Select>
          </Field>
        </section>

        {/* Цены (§17) */}
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Цены, ₽</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Базовая *"><TextInput type="number" min={0} value={form.basePrice} onChange={(e) => set('basePrice', Number(e.target.value))} /></Field>
            <Field label="Взрослый"><TextInput type="number" min={0} value={form.adultPrice} onChange={(e) => set('adultPrice', Number(e.target.value))} /></Field>
            <Field label="Ребёнок 10–14"><TextInput type="number" min={0} value={form.child10to14Price} onChange={(e) => set('child10to14Price', Number(e.target.value))} /></Field>
            <Field label="Ребёнок до 10"><TextInput type="number" min={0} value={form.childUnder10Price} onChange={(e) => set('childUnder10Price', Number(e.target.value))} /></Field>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Что включено"><TextArea value={form.includedText} onChange={(e) => set('includedText', e.target.value)} /></Field>
            <Field label="Что не включено"><TextArea value={form.notIncludedText} onChange={(e) => set('notIncludedText', e.target.value)} /></Field>
          </div>
        </section>

        {/* SEO (§30) */}
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">SEO</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="metaTitle" hint="До 60 символов"><TextInput value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} maxLength={160} /></Field>
            <Field label="metaDescription" hint="До 160 символов"><TextInput value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} maxLength={300} /></Field>
          </div>
        </section>

        {/* Программа (§9) */}
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Программа по дням</h2>
            <Button variant="secondary" onClick={addDay}>+ Добавить день</Button>
          </div>
          {days.length === 0 && <p className="text-sm text-neutral-500">Дни не заданы.</p>}
          <div className="space-y-3">
            {days.map((d, i) => (
              <div key={i} className="rounded-md border border-neutral-200 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-600">День {i + 1}</span>
                  <label className="ml-auto flex items-center gap-1 text-xs text-neutral-600">
                    <input type="checkbox" checked={d.overnight} onChange={(e) => patchDay(i, { overnight: e.target.checked })} />
                    ночёвка
                  </label>
                  <Button variant="ghost" onClick={() => moveDay(i, -1)} disabled={i === 0} aria-label="Выше">↑</Button>
                  <Button variant="ghost" onClick={() => moveDay(i, 1)} disabled={i === days.length - 1} aria-label="Ниже">↓</Button>
                  <Button variant="ghost" onClick={() => removeDay(i)} aria-label="Удалить день">×</Button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <TextInput placeholder="Заголовок дня" value={d.title} onChange={(e) => patchDay(i, { title: e.target.value })} />
                  <TextInput placeholder="Питание (напр.: завтраки)" value={d.meals} onChange={(e) => patchDay(i, { meals: e.target.value })} />
                </div>
                <TextArea className="mt-2" placeholder="Описание дня" value={d.description} onChange={(e) => patchDay(i, { description: e.target.value })} />
              </div>
            ))}
          </div>
        </section>

        {/* Галерея (§10, §41) */}
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Фотографии</h2>
            <Button variant="secondary" onClick={addImageSlot}>+ Добавить фото</Button>
          </div>
          {images.length === 0 && <p className="text-sm text-neutral-500">Галерея пуста.</p>}
          <div className="space-y-3">
            {images.map((im, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-200 p-3">
                {im.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={im.url} alt={im.alt} className="h-16 w-24 rounded object-cover" />
                ) : (
                  <div className="flex h-16 w-24 items-center justify-center rounded bg-neutral-100 text-xs text-neutral-400">нет</div>
                )}
                <label className="text-sm">
                  <span className="sr-only">Загрузить файл для фото {i + 1}</span>
                  <input type="file" accept="image/*" className="text-sm" disabled={uploadingIdx !== null} onChange={(e) => void onFilePicked(i, e.target.files?.[0])} />
                  {uploadingIdx === i && <span className="ml-2 text-xs text-brand-700">загрузка…</span>}
                </label>
                <TextInput className="w-40 flex-1" placeholder="URL (можно вставить)" value={im.url} onChange={(e) => patchImage(i, { url: e.target.value })} />
                <TextInput className="w-40 flex-1" placeholder="alt-текст (§44)" value={im.alt} onChange={(e) => patchImage(i, { alt: e.target.value })} />
                <label className="flex items-center gap-1 text-xs">
                  <input type="radio" name="cover" checked={im.isCover} onChange={() => setImages((ims) => ims.map((x, j) => ({ ...x, isCover: j === i })))} />
                  обложка
                </label>
                <Button variant="ghost" onClick={() => moveImage(i, -1)} disabled={i === 0} aria-label="Левее">←</Button>
                <Button variant="ghost" onClick={() => moveImage(i, 1)} disabled={i === images.length - 1} aria-label="Правее">→</Button>
                <Button variant="ghost" onClick={() => removeImage(i)} aria-label="Удалить фото">×</Button>
              </div>
            ))}
          </div>
        </section>

        {!isNew && tourId && (
          <p className="text-sm text-neutral-500">
            Выезды этого тура: <Link className="text-brand-700 underline" href={`/departures?tourId=${tourId}`}>управление расписанием →</Link>
          </p>
        )}
      </div>

      {/* Плавающая панель сохранения (§68 disable double-submit) */}
      <div className="sticky bottom-0 -mx-6 mt-6 border-t border-neutral-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void onSave(false)} busy={busy}>
            Сохранить
          </Button>
          <Button variant="secondary" onClick={() => void onSave(true)} busy={busy}>
            Сохранить всё (с программой и фото)
          </Button>
          <Link href="/tours" className="ml-auto text-sm text-neutral-600 hover:underline">
            ← К списку
          </Link>
        </div>
      </div>
    </AdminShell>
  );
}
