# Запуск ЧиркейТур на локальном компьютере

## Требования
- Node.js >= 20, npm >= 10
- Docker Desktop (для PostgreSQL) — либо локальный PostgreSQL 14+

> ℹ️ Архив содержит `package-lock.json` в корне — выполняйте **только один `npm install`**
> в корне проекта: он сам поставит зависимости всех пакетов monorepo через workspaces.
> Отдельные `npm install` внутри apps/* не нужны.

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

> ⚠️ Если при работе сайта API пишет ошибку вида
> `The column 'Destination.heroSlideImageUrl' does not exist in the current database` —
> значит ваша база была создана из СТАРОЙ схемы (до добавления новых колонок), и
> `migrate deploy` ничего не делает, т.к. все миграции уже «применены».
> Самый простой способ для локальной разработки с демо-данными — пересоздать базу
> с нуля (ВНИМАНИЕ: все данные будут удалены):
> ```powershell
> npx prisma migrate reset --force   # удалит таблицы и применит миграции заново
> npm run seed                       # затем обязательно пересейте демо-данные
> ```

## 4. Запуск приложений
```bash
npm run dev            # turbo: api :3001, web :3000, admin :3002
```
Страницы:
- http://localhost:3000            — публичный сайт
- http://localhost:3000/tours      — каталог
- http://localhost:3002/login       — админка (доступ: ADMIN_EMAIL/ADMIN_PASSWORD из .env перед seed)
- http://localhost:3001/api/docs   — Swagger
- http://localhost:3001/api/health — состояние API+БД

⚠️ Важно про вход в админку: логин/пароль администратора создаются **только в момент
`npm run seed`** из значений `ADMIN_EMAIL` / `ADMIN_PASSWORD` вашего `.env`.
В демо-режиме (значения по умолчанию из `.env.example`) это:
  email:    admin@example.com
  пароль:   admin123456

Пароль НЕ читается из `.env` приложением во время логина — он был захеширован в БД
в момент сида. Поэтому после ЛЮБОЙ смены `ADMIN_PASSWORD` обязательно повторите
`npm run seed` (текущая версия seed обновляет хеш существующего админа автоматически).

⚠️ Если seed падает с ошибкой `Cannot find module .../slug` или запускается через
`ts-node` — ваша локальная копия устарела. Проверьте: в корневом `package.json` скрипт
`seed` должен быть `"tsx prisma/seed.ts"`, а импорт в `prisma/seed.ts` — заканчиваться
на `slug.ts`. Обновитесь командой `git pull` (если она не подтягивает изменения,
сравните вывод `git log -1 --format=%ci` с датой последнего коммита на GitHub).

Если вход всё равно не работает, проверьте содержимое `.env`:
1. В файле `.env` должна быть ровно ОДНА строка `ADMIN_PASSWORD=...` (последняя побеждает).
   Типичная ошибка Windows: команда `Out-File .env -Encoding utf8` ДОПИСЫВАЕТ файл к
   старому вместо перезаписи — в итоге в конце файла остаётся старый пароль.
   Проверка в PowerShell: `Select-String ADMIN_PASSWORD .env`
2. Пароль должен совпадать символ в символ (без лишних пробелов/кавычек):
   `ADMIN_PASSWORD=admin123456`
3. После правок: `npm run seed` → убедиться, что в выводе есть строка
   `Updated admin user ... (password synced with .env)` → войти с НОВЫМ паролем.
4. Если seed завершился ошибкой (например, недоступна БД), хеш в базе НЕ обновился —
   сначала почините БД (`http://localhost:3001/api/health`), затем повторите seed.

## 5. Проверки
```bash
npm run lint && npm run typecheck && npm run test
```

## Примечание про localhost
Серверы, запущенные в песочнице агента, недоступны с вашего компьютера.
`localhost` всегда указывает на вашу машину — поэтому запуск выполняется
локально по инструкции выше (или через SSH-проброс портов, если есть доступ).
