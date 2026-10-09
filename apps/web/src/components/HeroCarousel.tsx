'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ru } from '@/content/ru';

export interface HeroSlideData {
  destinationId: string;
  slug: string; // slug направления — запасная цель клика
  tourSlug: string | null; // главный тур слайда — приоритетная цель клика
  title: string;
  text: string;
  imageUrl: string | null;
}

const AUTOPLAY_MS = 6000;

/**
 * Карусель под верхним меню главной (управляется из админки: раздел «Направления»,
 * поля showInHero / heroSlideImageUrl / heroSlideTitle / heroSlideText / heroSortOrder).
 * Клик по слайду ведёт на тур (tourSlug), иначе — на страницу направления.
 * Навигация: стрелки влево/вправо, точки, свайп, автопрокрутка (пауза при наведении/фокусе).
 */
export function HeroCarousel({ slides }: { slides: HeroSlideData[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  // Автопрокрутка
  useEffect(() => {
    if (count <= 1 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [count, paused]);

  // Клавиатура: ← → когда карусель в фокусе
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
  };

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={ru.home.popularDestinations}
      className="relative bg-stone-950 text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      tabIndex={-1}
    >
      <div
        className="relative h-[320px] overflow-hidden sm:h-[420px] lg:h-[480px]"
        onKeyDown={onKeyDown}
        onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX ?? null;
          touchX.current = null;
          if (start === null || end === null) return;
          const dx = end - start;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        }}
        role="group"
        aria-label={ru.home.carouselDots}
      >
        {/* Лента слайдов */}
        <div
          className="flex h-full transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((s, i) => {
            const href = s.tourSlug ? `/tours/${s.tourSlug}` : `/destinations/${s.slug}`;
            return (
              <div
                key={s.destinationId}
                className="relative h-full w-full shrink-0"
                aria-hidden={i !== index}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${count}: ${s.title}`}
              >
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt={s.title} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-800" aria-hidden />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" aria-hidden />
                <Link
                  href={href}
                  className="group relative z-10 flex h-full flex-col justify-end focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                  aria-label={s.title}
                >
                  <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6">
                    <h2 className="max-w-2xl font-serif text-2xl font-bold leading-snug drop-shadow sm:text-3xl lg:text-4xl group-hover:text-amber-300">
                      {s.title}
                    </h2>
                    {s.text ? (
                      <p className="mt-3 line-clamp-2 max-w-xl text-sm text-stone-100/90 sm:text-base">{s.text}</p>
                    ) : null}
                    <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-stone-900 shadow transition group-hover:bg-amber-400">
                      {ru.home.carouselMore}
                      <span aria-hidden>→</span>
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Стрелки */}
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={ru.home.carouselPrev}
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2.5 text-white backdrop-blur transition hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M12.5 4 7 10l5.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={ru.home.carouselNext}
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2.5 text-white backdrop-blur transition hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M7.5 4 13 10l-5.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </>
        ) : null}
      </div>

      {/* Точки-индикаторы */}
      {count > 1 ? (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2" role="tablist" aria-label={ru.home.carouselDots}>
          {slides.map((s, i) => (
            <button
              key={s.destinationId}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${i + 1}: ${s.title}`}
              onClick={() => go(i)}
              className={`h-2.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${
                i === index ? 'w-7 bg-amber-400' : 'w-2.5 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
