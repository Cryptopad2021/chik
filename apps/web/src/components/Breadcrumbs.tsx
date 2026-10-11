import Link from 'next/link';

export interface Crumb {
  name: string;
  href?: string;
}

/** Breadcrumbs UI (ТЗ §30/13.4). Последняя позиция — текущая страница (aria-current). */
export function Breadcrumbs({ items, className = '' }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="breadcrumb" className={`text-sm text-stone-500 ${className}`}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.name}-${i}`} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-emerald-800 hover:underline">{c.name}</Link>
              ) : (
                <span aria-current={last ? 'page' : undefined}>{c.name}</span>
              )}
              {!last && <span aria-hidden>›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
