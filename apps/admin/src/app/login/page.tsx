// Форма входа подключается в PHASE 4/9 (auth API + RBAC). Сейчас — статичный каркас.
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Вход в админ-панель</h1>
      <p className="text-neutral-600">Авторизация будет доступна после PHASE 4.</p>
    </main>
  );
}
