'use client';

/**
 * Мини UI-кит админки (PHASE 9.10): кнопки с защитой от двойного сабмита,
 * поля форм, состояния загрузки/ошибок/пустоты, диалог подтверждения (§66),
 * скелетоны (§68).
 */
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/* ===== Кнопка: disabled во время async-действия (§68 double-submit) ===== */
interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  busy?: boolean;
}

export function Button({ variant = 'primary', busy, disabled, children, className = '', ...rest }: ActionButtonProps) {
  const base =
    variant === 'primary'
      ? 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300'
      : variant === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
        : variant === 'ghost'
          ? 'text-neutral-700 hover:bg-neutral-100'
          : 'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50';
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${base} ${className}`}
      {...rest}
    >
      {busy && <Spinner className="h-4 w-4 border-current" />}
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-6 w-6 border-brand-600' }: { className?: string }) {
  return <span role="status" aria-label="Загрузка" className={`inline-block animate-spin rounded-full border-2 border-transparent border-t-current ${className}`} />;
}

/* ===== Поля формы ===== */
const fieldCls =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-neutral-100';

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-neutral-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldCls} ${props.className ?? ''}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${fieldCls} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldCls} ${props.className ?? ''}`} />;
}

/* ===== Сообщения / состояния ===== */
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Закрыть" className="font-bold">
          ×
        </button>
      )}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
      {message}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center">
      <p className="font-medium text-neutral-700">{title}</p>
      {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="h-4 rounded bg-neutral-200" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ===== Диалог подтверждения удаления (§66) ===== */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Удалить',
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-2 text-sm text-neutral-600">{description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Отмена
          </Button>
          <Button variant="danger" onClick={onConfirm} busy={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Обёртка async-действия с флагом busy (защита от двойного нажатия, §68). */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/* ===== Пагинация (§65) ===== */
export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between pt-3 text-sm" aria-label="Пагинация">
      <Button variant="secondary" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        ← Назад
      </Button>
      <span className="text-neutral-600">
        Стр. {page} из {totalPages}
      </span>
      <Button variant="secondary" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>
        Вперёд →
      </Button>
    </nav>
  );
}
