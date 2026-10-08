# CHIRKEY TOUR — ARCHITECTURE

Документ описывает текущую архитектуру (as-is), целевую (to-be), покрытие ТЗ, риски и план миграции. Детали аудита — в `PROJECT_AUDIT.md`, рабочий ход работ — в `PLAN.md`.

---

## 1. Текущая архитектура (as-is)

```
┌──────────────┐   polling    ┌─────────────────────┐   asyncpg    ┌────────────┐
│ Telegram API │ ◄──────────► │ bot.py + tgbot/*    │ ───────────► │ PostgreSQL │
└──────────────┘   aiogram 2  │ (DbMiddleware,      │  SQLAlchemy  │ telegram_  │
                              │  AdminFilter, echo) │     1.4      │ users,     │
                              └─────────────────────┘              │ referral_  │
                                                                   │ users      │
                                                                   └────────────┘
```

- Единственный исполняемый компонент — Python-бот (polling).
- Схема БД создаётся императивно (`create_all`), без миграций.
- Публичного сайта, REST API, админки, авторизации нет.

## 2. Целевая архитектура (to-be)

### 2.1 Компоненты

```
                         ┌─────────────── CDN / reverse proxy (nginx) ───────────────┐
                         │   chirkey.tour → /apps/web    admin.chirkey.tour → /admin  │
                         └───────────────┬───────────────────────┬────────────────────┘
                                         │ SSR                   │ SPA/RSC
   Браузер пользователя ─────────────────┤                       ├─── REST ──┐
   Telegram-пользователь ── webhook ──┐  │                       │           │
                                     ▼  ▼                       ▼           ▼
                              ┌──────────────────────────────────────────────────┐
                              │            /apps/api  (NestJS, :3001)            │
                              │ REST /api/* + Swagger /api/docs                  │
                              │ Guards: JwtAuthGuard + RolesGuard(RBAC)          │
                              │ Interceptors: requestId, logging(redact secrets) │
                              │ Filters: ApiExceptionFilter (единый формат §45)  │
                              │ Pipes: global ValidationPipe (whitelist)         │
                              │ Modules: auth users tours destinations departures│
                              │  departure-cities bookings customers reviews     │
                              │  telegram notifications media settings audit faq │
                              │  promo-codes contact-requests analytics health   │
                              │  scheduler (cron: reminders, stale bookings)     │
                              └───┬───────────────┬──────────────┬───────────────┘
                                  │ Prisma        │ Bot API      │ SMTP (abstraction)
                                  ▼               ▼              ▼
                            ┌──────────┐  ┌─────────────┐  ┌──────────┐
                            │PostgreSQL│  │ Telegram    │  │ Email    │
                            │(single   │  │ Channel/Bot │  │ provider │
                            │ schema)  │  └─────────────┘  └──────────┘
                                  ▲
                            ┌─────┴─────┐     ┌─────────┐
                            │ S3-compat │     │ Redis * │ (* опц.: rate-limit,
                            │ (media)   │     │         │   queue, cache)
                            └───────────┘     └─────────┘
```

### 2.2 Монорепо

| Директория | Назначение | Стек |
|---|---|---|
| `apps/web` | публичный сайт (RU, i18n-ready) | Next.js App Router, TS, Tailwind, shadcn/ui, RHF+Zod, TanStack Query (client data) |
| `apps/admin` | админ-панель + CRM | Next.js, TS, Tailwind, общие UI-компоненты |
| `apps/api` | backend | NestJS, TS, Prisma, class-validator DTO + zod shared schemas, Swagger |
| `packages/types` | доменные enum/DTO типы | TS |
| `packages/validation` | zod-схемы (клиент = сервер source of truth) | zod |
| `packages/ui` | переиспользуемые компоненты | React + tailwind |
| `packages/config` | общий tsconfig/eslint/prettier | — |
| `prisma/` | схема, миграции, seed | Prisma |
| `services/tgbot-legacy` | существующий Python-бот (deprecated после Phase 10) | aiogram 2 |
| `infrastructure/docker` | compose, Dockerfiles, nginx | Docker |
| `docs/` | AUDIT / PLAN / ARCHITECTURE / DEPLOYMENT | Markdown |

Tooling: npm workspaces + Turborepo; скрипты корня `lint`, `typecheck`, `test`, `build`.

### 2.3 Поток данных бронирования (ключевой сценарий)

```
web wizard (дата→город→туристы→контакты→подтверждение)   telegram bot (FSM)
        │  POST /api/bookings {departureId, cityId, pax, contacts}        │
        ▼                                                                 ▼
   BookingsService.createInTransaction(tx):
     1. SELECT departure FOR UPDATE          ← блокировка строки (анти-overbooking)
     2. seats >= requested ? иначе SEATS_INSUFFICIENT (409)
     3. upsert Customer (phone/email/tg username)
     4. INSERT Booking (NEW, bookingNumber CT-YYYYMMDD-XXXX, source WEBSITE|TELEGRAM)
     5. INSERT BookingPassenger[]
     6. recalc availableSeats/status
     7. INSERT AuditLog + enqueue Notification(booking.created → manager)
   COMMIT → ответ { bookingNumber, statusUrl }
```

Оба канала (сайт и бот) пишут в одну таблицу Booking — единая CRM-картина (§32).

### 2.4 Auth-flow

- Логин staff → access JWT (память клиента, короткая жизнь) + refresh JWT (httpOnly Secure SameSite=Lax cookie, path=/api/auth).
- Ротация refresh: каждый refresh инвалидирует старый jti (таблица RefreshToken/или hash в БД); reuse → отзыв всей семьи токенов.
- CSRF: cookie-refresh требует double-submit CSRF-token (header) — стратегия зафиксирована в §39.
- RBAC на backend через `@Roles()`/`@Permissions()` + RolesGuard; frontend лишь скрывает UI.

### 2.5 Хранилище файлов

Media Library → presigned PUT в S3-compatible (MinIO dev / real S3 prod) → callback в API создаёт `File` (filename, mimeType, size, width, height, url, alt, uploadedBy). Бинарные данные в PostgreSQL не попадают (§10).

### 2.6 Telegram

- Incoming: Bot API webhook → `TelegramBotController` (проверка `X-Telegram-Bot-Api-Secret-Token`) → ConversationState (FSM в БД/Redis) → Booking(source=TELEGRAM).
- Outgoing: `TelegramService` (sendMessage/sendPhoto/publishTour...) — токен только из env; никогда не логируется.
- Publication: шаблон §34 рендерится сервером → пост в канал → `TelegramPost(telegramMessageId, status)`.
- Legacy aiogram-бот сосуществует только пока флаг `TELEGRAM_LEGACY_ENABLED=true`; при включении webhook-бота legacy останавливается (polling конфликтует с webhook).

## 3. Что уже существует / что добавить

| Домен ТЗ | As-is | To-be (фаза) |
|---|---|---|
| Каталог туров, страницы туров | нет | P5, P8 |
| Выезды, города отправления | нет | P6 |
| Бронирование + пассажиры | нет | P7 |
| CRM клиентов | таблица telegram_users (не CRM) | P7/P9 |
| Отзывы, FAQ, ContactRequest | нет | P2/P9 |
| RBAC/Auth | ADMINS по ID в env | P4 |
| Telegram-бот бронирования | hello/echo заглушки | P10 |
| Публикация в канал | нет | P10 |
| Notifications/Email/SMS | нет | P11 |
| Payment abstraction | нет | P2(model)+P7(pay-link), интеграция провайдера — отдельным решением |
| Media/S3 | нет | P5/P9 |
| Audit log | нет | P3–P4 |
| Analytics/dashboards | нет | P12 |
| SEO/sitemap/JSON-LD | нет | P13 |
| Docker/CI | partial (bot only) | P1/P16 |

## 4. Риски и меры

| Риск | Мера |
|---|---|
| Конкурентные брони (overselling) | транзакция + `FOR UPDATE` + integration-тест параллельности (P6–P7, §54) |
| Секреты в коде/Git | `.env.example` без значений, CI grep-check, redaction logger |
| aiogram 2 EOL | новый бот на NestJS webhook; legacy изолирован и отключается флагом |
| Двойной запуск ботов (polling+webhook) | feature flag + runbook в DEPLOYMENT.md |
| Нет Docker в dev-среде | unit-тесты без БД; интеграционные — под `DATABASE_URL` skip-guard; compose валидируется статически |
| Разрастание monorepo build | turbo cache, границы пакетов, workspace deps только через `@chirkey/*` |
| GDPR | минимальные ПДн в формах (§16), ссылка на privacy (§72), analytics без ПДн (§71) |

## 5. План миграции (кратко)

1. **P1** — перенос legacy в `services/tgbot-legacy` (git mv), каркас monorepo, тулинг, compose, CI.
2. **P2** — Prisma-схема всего домена + миграция + demo-seed.
3. **P3–P4** — Nest core (errors/logging/swagger/security) → auth/RBAC + тесты.
4. **P5–P7** — tours → departures (locking) → bookings (транзакционный engine) + concurrency test.
5. **P8–P9** — публичный сайт → админка/CRM.
6. **P10–P12** — Telegram (webhook/bot/publication) → notifications/cron → analytics.
7. **P13–P16** — SEO → полный тест-прогон → performance → production docs/Docker.
8. Legacy-бот: deprecated → off (после покрытия функций P10) → удаление только по решению владельца.

## 6. Матрица «раздел ТЗ → артефакт»

§5–6,8–14,16 → `prisma/schema.prisma`; §7,39,40 → `apps/api/src/modules/auth`, guards; §15,17 → bookings service + pricing fields; §18–23 → `apps/admin`; §24–25 → reviews/faq modules; §26–29,42–44,58,62,64,69–70 → `apps/web`; §30,60 → metadata/sitemap/indices; §31–35 → telegram/notifications modules; §36 → email abstraction; §37 → payment module interface; §38 → audit module; §41 → media module; §45–48 → api core; §49–51 → prisma/.env.example; §52 → infrastructure; §53–54 → tests; §55 → scheduler; §56–57 → settings/content module; §59 → legal pages placeholders; §71–73 → analytics; §75–80 → процесс (см. PLAN.md).
