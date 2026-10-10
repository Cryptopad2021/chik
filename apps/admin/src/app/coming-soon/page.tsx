'use client';

/**
 * Заглушка для разделов админки, UI которых ещё не построен (PHASE 9).
 * Sidebar ссылается сюда с ?section=<название>.
 */
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';

function ComingSoonInner() {
  const section = useSearchParams().get('section') ?? 'Раздел';
  return (
    <AdminShell title={section}>
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center">
        <p className="text-4xl" aria-hidden>
          🚧
        </p>
        <h2 className="mt-3 text-lg font-semibold text-neutral-900">{section}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
          Этот раздел находится в разработке и появится в ближайших обновлениях.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Вернуться на дашборд
        </Link>
      </div>
    </AdminShell>
  );
}

export default function ComingSoonPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-neutral-500">Загрузка…</div>}>
      <ComingSoonInner />
    </Suspense>
  );
}
