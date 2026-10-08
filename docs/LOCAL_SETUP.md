# Запуск ЧиркейТур на локальном компьютере

## Требования
- Node.js >= 20, npm >= 10
- Docker Desktop (для PostgreSQL) — либо локальный PostgreSQL 14+

## 0. Почему проекта нет на GitHub и как его перенести

Код лежит в песочнице агента (изолированный контейнер). В этом репозитории **не настроен
GitHub-remote**, поэтому на github.com вы его не видите — там только старая история.
Перенести проект на свой компьютер можно тремя способами.

### Вариант 1 — архив chirkey-tour.tar.gz (самый простой)
Скачайте файл `chirkey-tour.tar.gz` из корня песочницы (кнопка скачивания файлов среды)
и распакуйте:
```bash
# Linux/macOS
tar -xzf chirkey-tour.tar.gz -C ~/projects/chirkey-tour
# Windows: откройте архив любым unpacker (7-Zip/Bandizip) или:
tar -xzf chirkey-tour.tar.gz -C C:\projects\chirkey-tour
```
Это чистый код без node_modules/.git — дальше идите к пункту «2. Установка».

### Вариант 2 — git bundle (код сразу с git-историей)
Скачайте `chirkey-tour.bundle` (~300 КБ) и выполните:
```bash
git clone chirkey-tour.bundle chirkey-tour
cd chirkey-tour
git checkout main        # клон стартует в detached HEAD — обязательно переключитесь
```

### Вариант 3 — загрузить на свой GitHub
После любого из вариантов 1–2 (или из готового bundle):
```bash
cd chirkey-tour
# создайте пустой публичный/приватный репозиторий на github.com БЕЗ README,
# затем:
git init -b main              # если это распакованный tar.gz без .git
git add -A && git commit -m "chirkey-tour: phases 0-8"
git remote add origin https://github.com/<ВАШ_ЛОГИН>/<репо>.git
git push -u origin main       # GitHub спросит логин+Personal Access Token
```
Для push нужен Personal Access Token (github.com → Settings → Developer settings →
Fine-grained tokens, права Contents: Read&Write). Пароль от аккаунта GitHub не принимает.
⚠️ Никогда не коммитьте `.env` с реальными секретами — он уже в `.gitignore`.

## 2. Установка
```bash
npm install          # в корне monorepo (workspaces)
cp .env.example .env # затем заполните DATABASE_URL и т.д.
```

## 3. База данных
```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres
npx prisma migrate deploy   # применит миграции к БД
npm run seed                # демо-данные (помечены как demo)
```
Без Docker: создайте БД `chirkey` в локальном PostgreSQL и укажите
`DATABASE_URL=postgresql://user:pass@localhost:5432/chirkey` в .env.

## 4. Запуск приложений
```bash
npm run dev            # turbo: api :3100, web :3000, admin :3001
```
Страницы:
- http://localhost:3000            — публичный сайт
- http://localhost:3000/tours      — каталог
- http://localhost:3100/api/docs   — Swagger
- http://localhost:3100/api/health — состояние API+БД

Demo-администратор (из seed, только для локальной разработки):
email и пароль указаны в prisma/seed.ts.

## 5. Проверки
```bash
npm run lint && npm run typecheck && npm run test
```

## Примечание про localhost
Серверы, запущенные в песочнице агента, недоступны с вашего компьютера.
`localhost` всегда указывает на вашу машину — поэтому запуск выполняется
локально по инструкции выше (или через SSH-проброс портов, если есть доступ).
