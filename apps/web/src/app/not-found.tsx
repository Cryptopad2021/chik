import type { Metadata } from 'next';
import Link from 'next/link';
import { ru } from '@/content/ru';

export const metadata: Metadata = { title: ru.notFound.title, robots: { index: false } };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center">
      <p className="text-6xl font-bold text-emerald-200">404</p>
      <h1 className="mt-4 font-serif text-2xl font-bold text-emerald-950">{ru.notFound.title}</h1>
      <p className="mt-2 text-stone-600">{ru.notFound.text}</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">{ru.notFound.home}</Link>
        <Link href="/tours" className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50">{ru.common.ctaPrimary}</Link>
      </div>
    </div>
  );
}
