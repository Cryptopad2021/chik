# PHASE 0 — АУДИТ ПРОЕКТА «ЧиркейТур» (CHIRKEY TOUR)

**Дата аудита:** 2026-10-09
**Ветка:** `qwen-code-1a1a83ce-2020-4cd5-a855-915901a1e839`
**HEAD коммит:** `2b42323 Initialize Postgres+SQLAlchemy`
**Рабочее дерево:** чистое (`git status`: nothing to commit)

---

## 1. Текущая структура проекта

```
/workspace
├── .env.dist              # пример переменных окружения (bot template)
├── .gitignore             # python-only gitignore
├── Dockerfile             # образ для Python-бота (python:3.9-slim)
├── docker-compose.yml     # единственный сервис: bot
├── requirements.txt       # aiogram 2.12, aioredis, environs, SQLAlchemy 1.4
├── bot.py                 # точка входа aiogram-бота (polling)
├── systemd/
│   └── tgbot.service      # unit-файл для запуска бота на сервере
└── tgbot/                 # пакет бота (шаблон "Python-Telegram-Bot" aiogram 2)
    ├── __init__.py        # пустой
    ├── config.py          # load_config через environs (.env)
    ├── filters/admin.py   # AdminFilter по списку ADMINS из env
    ├── handlers/          # admin.py, user.py, echo.py — заглушки "Hello"
    ├── keyboards/         # inline.py, reply.py — ПУСТЫЕ файлы
    ├── middlewares/db.py  # DbMiddleware: upsert Telegram-пользователя в БД
    ├── misc/states.py     # ПУСТОЙ файл
    ├── models/users.py    # SQLAlchemy-модели User(telegram_users), Referral
    └── services/
        ├── db_base.py     # declarative_base
        └── database.py    # create_async_engine (asyncpg), create_all
```

## 2. Используемый стек (фактически)

| Слой            | Что есть сейчас                                   |
|-----------------|----------------------------------------------------|
| Язык            | Python 3.9 (Dockerfile) / требования ТЗ: TypeScript |
| Telegram        | aiogram **2.12.1** (устаревшая major-версия; актуальная — 3.x) |
| ORM             | SQLAlchemy 1.4 async + asyncpg                     |
| БД              | PostgreSQL (только подключение; контейнера PG в compose **нет**) |
| Frontend        | **ОТСУТСТВУЕТ** (ни публичного сайта, ни админки)  |
| Backend API     | **ОТСУТСТВУЕТ** (нет REST API, нет NestJS)         |
| Auth            | **ОТСУТСТВУЕТ**                                    |
| Storage (S3)    | **ОТСУТСТВУЕТ**                                    |
| CI/CD           | **ОТСУТСТВУЕТ**                                    |
| Tests / Lint    | **ОТСУТСТВУЕТ**                                    |
| Node.js в среде | v20.20.2, npm 10.8.2 — доступны для Next.js/NestJS |
| Docker в среде  | **НЕДОСТУПЕН** (compose-файлы создаём, но собрать/запустить здесь нельзя) |
| psql в среде    | **НЕДОСТУПЕН**                                     |

## 3. Найденные зависимости (requirements.txt)

- `aiogram~=2.12.1` — фреймворк TG-бота (legacy API: Dispatcher, register_message_handler, MemoryStorage/RedisStorage из contrib)
- `aioredis` — не используется напрямую, только через `USE_REDIS`
- `environs~=8.0.0` — чтение `.env`
- `SQLAlchemy~=1.4.18` — async ORM
- В коде также упоминаются, но **отсутствуют** в requirements: `asyncpg` (нужен для postgresql+asyncpg), `faker` (в тест-блоке models/users.py)

## 4. Существующий функционал

Реально работающий функционал минимален — это стартовый шаблон aiogram-бота:

1. **Polling-бот**: `/start` → «Hello, user!» / «Hello, admin!», эхо всех остальных сообщений.
2. **DbMiddleware**: при любом апдейте пользователь регистрируется/обновляется в таблице `telegram_users` (telegram_id, имя, username, lang, role).
3. **AdminFilter**: различение админов по числовым ID из env `ADMINS`.
4. **Модель Referral**: таблица реферальных связей (бизнес-смысла для туркомпании не несёт).
5. **Конфигурация**: загрузка BOT_TOKEN / ADMINS / DB_* из `.env` через `environs`.
6. **Docker/systemd**: каркас деплоя одного контейнера бота.

Никакого туристического домена (туры, выезды, бронирования, отзывы) **нет**.

### Дефекты найденного кода

- `tgbot/models/users.py`: `count_referrals` ссылается на `Referral` **до её объявления** в скоупе метода — NameError при вызове; join/group_by логически некорректен.
- `Referral.add_user`: параметр `db_session: sessionmaker`, внутри переопределяется `async with db_session() as db_session` — читается как ошибка; FK без индекса.
- `config.py`: `TgBot.admin_ids: int`, фактически `list` — несоответствие аннотации.
- `Dockerfile`: `WORKDIR /usr/src/app/"${BOT_NAME}"` — кавычки в пути, хрупкая конструкция; base image python:3.9 EOL.
- `docker-compose.yml`: сервиса PostgreSQL нет, хотя конфиг требует DB_HOST/DB_PASS; версия файла 3.3 устарела.
- `.env.dist`: нет ни одной переменной для будущего стека (JWT, S3, Email и т.д.).
- `keyboards/inline.py`, `keyboards/reply.py`, `misc/states.py` — пустые заглушки.
- Секретов в Git нет (проверено: только примеры в `.env.dist`) — это хорошо.

## 5. Проблемы

1. **Архитектурный разрыв**: ТЗ требует monorepo Next.js + NestJS + Prisma + React-admin-панель, а в репозитории — solo Python-бот. Ничего общего, кроме PostgreSQL и Telegram-тематики.
2. **aiogram 2 legacy**: если сохранять Python-бота — миграция на aiogram 3 обязательна (2.12 не поддерживается). Но по ТЗ Telegram-логика должна жить в NestJS-сервисах (`/apps/api`), общая БД с Booking.
3. **Единого источника данных нет**: схема БД создаётся через `Base.metadata.create_all` — без migrations, что противоречит требованию Prisma migrations.
4. **Нет ни тестов, ни линтеров, ни typecheck** — Definition of Done невыполним без фундамента.
5. **Docker в этой среде недоступен** — интеграционные проверки нужно проектировать так, чтобы они запускались без контейнеров (или с внешней БД через DATABASE_URL); unit-тесты должны работать без БД.
6. **Контент канала t.me/chirkey_tour3** недоступен из среды (нет сети/парсинга) — seed-данные помечаем явно как demo/seed, юридические реквизиты — placeholder (согласно п.59, 76 ТЗ).

## 6. Потенциальные конфликты

- **Python-код vs Node-monorepo**: если оставить `tgbot/` в корне, он будет попадать в lint/build контекст. Решение: перенести в `services/tgbot-legacy/` (или `apps/tgbot`), изолировать конфигурацией инструментов (turbo/eslint ignore), ничего не удаляя.
- **requirements.txt в корне** конфликтует с npm-workspaces корнем → перенос вместе с ботом.
- **`.env.dist` vs будущий `.env.example`**: сохраним старый файл для совместимости legacy-бота, добавим новый `.env.example` для платформы (п.51 ТЗ).
- **Две экosистемы токенов Telegram**: legacy-бот использует BOT_TOKEN polling; новая платформа — webhook + то же приложение. При одновременном запуске возможны конфликты polling/webhook → фиксируем в плане миграции (отключать legacy перед включением нового бота; feature flag).
- **PostgreSQL-схема**: таблицы legacy (`telegram_users`, `referral_users`) vs Prisma-схема. Решение: Prisma становится единственным владельцем схемы; legacy-таблицы при необходимости переносятся миграцией/ко-экзистенцией в отдельной схеме `legacy`.

## 7. Предлагаемая целевая архитектура

Сохраняем требование monorepo из ТЗ с минимальными отклонениями (обоснование — ниже):

```
/apps
  /web        # Next.js 14 App Router + TS + Tailwind + shadcn/ui — публичный сайт (SSR/SEO)
  /api        # NestJS + TS — REST API, Swagger, Prisma, RBAC, Telegram-бот (webhook), cron
  /admin      # Next.js (отдельное приложение) — админ-панель/CRM
/packages
  /ui         # переиспользуемые React-компоненты (shadcn-based)
  /types      # общие TS-типы/DTO/enum-ы
  /config      # общий eslint/prettier/tsconfig
  /validation # zod-схемы (клиент+сервер)
/services
  /tgbot-legacy  # ← перенесённый существующий Python-бот (не ломать, не удалять)
/infrastructure
  /docker        # Dockerfiles, docker-compose (postgres, api, web, admin, redis*, minio*)
/prisma          # schema.prisma, migrations, seed
/docs            # ARCHITECTURE.md, PROJECT_AUDIT.md, PLAN.md, DEPLOYMENT.md
```

*Redis/MetaMinIO — только при реальной необходимости (очереди уведомлений, объектное хранилище для Media Library).

**Обоснование отклонений от «идеальной» структуры ТЗ:**
1. Добавлен `/services/tgbot-legacy` — по правилу «не удаляй существующий рабочий функционал». Бот остаётся рабочим, но изолирован.
2. `prisma/` на верхнем уровне (а не внутри `/apps/api`) — единая схема для всего monorepo, seed и migration доступны из корня; NestJS-приложение импортирует генерируемый клиент. Это стандартная практика для monorepo и упрощает п.49–50 ТЗ.
3. Tooling: **npm workspaces + Turborepo** (а не pnpm/yarn) — npm уже доступен в среде, pnpm не установлен; минимум внешних зависимостей.

## 8. План миграции

1. **PHASE 1 (Foundation):** создать каркас monorepo (npm workspaces + turbo), TS/ESLint/Prettier базовые конфиги в `/packages/config`, `.env.example`, обновить `docker-compose.yml` (postgres + сервисы), НЕ трогая legacy-бота (перенос = `git mv`, содержимое идентично).
2. **PHASE 2 (Database):** полная Prisma-схема по разделам 6–14, 24–25, 33, 37–38, 41, 56 ТЗ + indexes (п.60–61) + seed с пометкой demo.
3. **PHASE 3–4:** NestJS-каркас (валидация, exception filter, Swagger, config) → Auth (JWT access/refresh, httpOnly cookies, RBAC 5 ролей) + тесты.
4. **PHASE 5–7:** Tours → Departures (транзакции, anti-overselling) → Bookings (пошаговый flow, пассажиры, цены с backend) + integration-тест конкурентного бронирования (п.54).
5. **PHASE 8–9:** публичный Next.js-сайт (страницы п.26, SEO п.30) и админ-панель (п.18–23, 65–68).
6. **PHASE 10–12:** Telegram (webhook, бот-бронирование, публикация в канал по шаблонам), Notification/Email abstraction, Analytics abstraction + dashboard.
7. **PHASE 13–16:** SEO-финализация, полный прогон тестов (unit/integration/E2E Playwright), performance pass, production Docker + `/docs/DEPLOYMENT.md`.
8. **Legacy-судьба:** после того как NestJS Telegram-модуль (webhook) покроет функции бота (п.31–34), `services/tgbot-legacy` помечается deprecated и выключается (feature flag + инструкция в DEPLOYMENT.md). Удаление — только отдельным решением пользователя.

## 9. Список следующих этапов

См. **`docs/PLAN.md`** — пошаговый план работ по фазам PHASE 0…16 с чекбоксами статусов. Отмечаем выполненные этапы там же.

## 10. Ограничения среды (честно)

- Нет Docker/postgres в этой среде → интеграционные тесты против живой БД будут написаны и настроены, но их запуск подтверждается только при наличии `DATABASE_URL`; это фиксируется в отчётах соответствующих фаз.
- Нет доступа к контенту Telegram-канала → seed = демонстрационные данные с явной пометкой.
