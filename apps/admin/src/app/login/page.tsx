'use client';

/**
 * Вход в админ-панель (PHASE 4, ТЗ §2, §39, §40):
 * email + пароль → POST /api/auth/login; remember me — session vs 30d cookie;
 * ошибки API показываются по формату §45; при успехе — редирект на /dashboard.
 */
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Введите email и пароль');
      return;
    }
    setPending(true);
    const res = await signIn(email.trim(), password, remember);
    setPending(false);
    if (res.ok) {
      router.replace('/dashboard');
    } else {
      setError(res.message ?? 'Не удалось войти');
      setPassword('');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Вход в админ-панель</h1>
        <p className="mt-1 text-sm text-neutral-600">ЧиркейТур — доступ для сотрудников</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 font-normal outline-none focus:border-neutral-500"
            placeholder="admin@chirkeytour.ru"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Пароль
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 font-normal outline-none focus:border-neutral-500"
            placeholder="••••••••"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4"
          />
          Запомнить меня (30 дней)
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {pending ? 'Входим…' : 'Войти'}
        </button>
      </form>

      <p className="text-xs text-neutral-500">
        Защита от перебора: после серии неудачных попыток вход будет временно ограничен.
      </p>
    </main>
  );
}
