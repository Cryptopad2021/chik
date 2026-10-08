/**
 * @chirkey/ui — общая UI-библиотека (shadcn/ui-совместимая структура).
 *
 * Фаза 1: каркас + базовые примитивы без внешних зависимостей, кроме React.
 * В фазах 8–9 сюда добавляются компоненты через shadcn CLI (`npx shadcn@latest add ...`)
 * с едиными токенами темы для apps/web и apps/admin.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}

/**
 * Кнопка с защитой от двойного submit (ТЗ §68): во время loading кнопка disabled.
 */
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Empty state (ТЗ §67): не показываем пустой экран. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div role="status" className="empty-state">
      <p className="empty-state__title">{title}</p>
      {description ? <p className="empty-state__desc">{description}</p> : null}
      {action}
    </div>
  );
}

/** Skeleton (ТЗ §68). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`.trim()} />;
}
