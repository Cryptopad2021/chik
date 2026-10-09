# CHIRKEY TOUR — ПОШАГОВЫЙ ПЛАН РАЗРАБОТКИ (рабочий документ)

> Формат: каждый пункт — чекбокс. `[x]` = выполнено и проверено, `[ ]` = не выполнено.
> Правила: не переходить к следующей фазе, пока текущая не проходит проверки
> (`lint`, `typecheck`, `test`). После каждой фазы — отчёт в конце раздела.
> Легенда ТЗ: номера пунктов соответствуют разделам технического задания.

---

## PHASE 0 — PROJECT AUDIT ✅ [ЗАВЕРШЕНА]

- [x] 0.1 Изучить repository (структура, git status, история)
- [x] 0.2 Найти package.json / зависимости — **отсутствуют** (проект Python-only)
- [x] 0.3 Найти существующий frontend — **отсутствует**
- [x] 0.4 Найти backend — **отсутствует** (только aiogram-бот)
- [x] 0.5 Найти database-слой — SQLAlchemy async + PostgreSQL (без migrations)
- [x] 0.6 Изучить environment (.env.dist, docker-compose, systemd)
- [x] 0.7 README — отсутствует
- [x] 0.8 Проверить git status (чисто, 1 коммит)
- [x] 0.9 Создать `/docs/PROJECT_AUDIT.md`
- [x] 0.10 Создать `/docs/PLAN.md` (этот файл) с планом из ТЗ
- [x] 0.11 Закоммитить результаты аудита → коммит `4cc1ffd docs(phase0): project audit, architecture, step-by-step plan`

**Отчёт PHASE 0:** STATUS: DONE. Implemented: полный аудит, цели/конфликты/план миграции.
Files: docs/PROJECT_AUDIT.md, docs/PLAN.md. DB/API/Frontend changes: нет. Tests: n/a.
Known issues: Docker/PostgreSQL недоступны в dev-среде. Next: PHASE 1.

---

## PHASE 1 — FOUNDATION (monorepo, тулинг, Docker, каркас)

- [x] 1.1 Перенести legacy-бота: `git mv tgbot services/tgbot-legacy/tgbot`, `git mv bot.py requirements.txt Dockerfile systemd services/tgbot-legacy/` (содержимое не менять)
- [x] 1.2 Корень: `package.json` (npm workspaces: apps/*, packages/*), `turbo.json`
- [x] 1.3 `.gitignore` расширить под Node (node_modules, .next, dist, coverage, .env*)
- [x] 1.4 `.env.example` со всеми переменными ТЗ §51 (без реальных секретов)
- [x] 1.5 `/packages/config`: базовые tsconfig, eslint-config, prettier-config (общие)
- [x] 1.6 `/packages/types`: скелет (enum-ы домена позже, в Phase 2)
- [x] 1.7 `/packages/validation`: скелет zod (схемы по мере появления фаз)
- [x] 1.8 `/packages/ui`: скелет React-библиотеки (shadcn-совместимая структура)
- [x] 1.9 `/apps/api`: каркас NestJS (TS, main.ts, AppModule, health endpoint)
- [x] 1.10 `/apps/web`: каркас Next.js App Router + Tailwind (RU locale structure)
- [x] 1.11 `/apps/admin`: каркас Next.js (админ-режим, отдельный порт)
- [x] 1.12 `/infrastructure/docker`: docker-compose.yml — postgres + api + web + admin (+ redis опционально, minio для S3); сохранение возможности запуска legacy tgbot через profile
- [x] 1.13 Базовый CI: `.github/workflows/ci.yml` — install, lint, typecheck, test, build
- [x] 1.14 Скрипты корня: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`
- [x] 1.15 Прогнать проверки: lint ✅, typecheck ✅, test ✅ (unit; интеграция — при наличии DATABASE_URL)
- [x] 1.16 Commit: «chore(phase1): monorepo foundation»

**Критерии готовности:** пустые приложения собираются, линт/тайпчек/тесты зелёные,
compose-файл валиден (`docker compose config` — если доступен).

---

## PHASE 2 — DATABASE (Prisma schema + migrations + seed)

- [x] 2.1 `/prisma/schema.prisma`: все сущности ТЗ §5–6, 8–14, 16, 24–25, 33, 37–38, 41, 56:
      User(+Role), Customer, Tour(+status DRAFT/PUBLISHED/ARCHIVED, deletedAt), TourDay,
      TourImage, Destination, Departure(+status OPEN/ALMOST_FULL/FULL/CANCELLED/COMPLETED),
      DepartureCity, Booking(+status 9 шт., source 5 шт.), BookingPassenger, Payment(+status 5 шт.),
      Review(+PENDING/APPROVED/REJECTED), TelegramPost, Notification, PromoCode, File,
      AuditLog, SiteSettings, Faq, ContactRequest, BookingStatusHistory
- [x] 2.2 Связи по ТЗ §6 (Tour→TourDay/Image/Departure/Destination; Departure→Booking; Booking→Passengers/Payment; Customer→Bookings)
- [x] 2.3 Индексы ТЗ §60–61: Tour.slug(u), Departure.startDate, Booking.bookingNumber(u),
      Booking.status, Customer.phone, Customer.telegramUsername, FK-индексы, Review.status, Faq.isPublished+sortOrder
- [x] 2.4 Enum-типы зеркалятся в `/packages/types`
- [x] 2.5 `npx prisma validate` ✅; `npx prisma generate` ✅
- [x] 2.6 Migration (SQL diff) — зафиксировать в `/prisma/migrations`; прокатить `migrate deploy` на dev-БД (если доступна) иначе — SQL-валидация вручную
- [x] 2.7 Seed (`/prisma/seed.ts`): направления (Дагестан, Осетия, Чечня, Ингушетия, Кавказ), туры, программы по дням, выезды, города (Ростов-на-Дону, Таганрог, Мариуполь, Бердянск, Приморск, Мелитополь, Геническ), клиенты, брони, отзывы, FAQ, админ — всё с флагом `isDemo=true` / префиксом «[DEMO]»
- [ ] 2.8 `npm run seed` — **отложен**: PostgreSQL недоступен в dev-среде; seed написан, прокатится в CI/Docker
- [x] 2.9 Commit: «feat(phase2): prisma schema, migrations, seed»

---

## PHASE 3 — BACKEND FOUNDATION (NestJS модули, Swagger, ошибки)

- [x] 3.1 PrismaService (singleton, onModuleDestroy)
- [x] 3.2 ConfigModule (env validation через zod/joi; секреты только из env)
- [x] 3.3 Global ValidationPipe (whitelist, forbidNonWhitelisted, transform)
- [x] 3.4 Единый формат ошибок ТЗ §45: `{ success:false, error:{ code, message } }` + ExceptionFilter + ErrorCode enum (BOOKING_NOT_FOUND и т.д.)
- [x] 3.5 Structured logging ТЗ §46 (timestamp, level, service, requestId, message, metadata; redact secrets/password/JWT/token)
- [x] 3.6 Security middleware: helmet, CORS allow-list, rate limiting (§39)
- [x] 3.7 Swagger/OpenAPI на `/api/docs` (§48), описать публичные и защищённые endpoints
- [x] 3.8 Каркас модулей: auth, users, tours, destinations, departures, departure-cities, bookings, customers, reviews, telegram, notifications, media, settings, audit, faq, promo-codes, contact-requests, analytics, health, scheduler
- [x] 3.9 Endpoints ТЗ §47 — маршруты зарегистрированы (реализация по фазам 4–10)
- [x] 3.10 Unit-тесты фильтра/логов + smoke e2e health; lint/typecheck/test ✅
- [x] 3.11 Commit: «feat(phase3): nest core (validation, errors, swagger, security)»

---

## PHASE 4 — AUTH + RBAC

- [x] 4.1 Password hashing (argon2/bcrypt), никогда не возвращать hash (§39)
- [x] 4.2 JWT access (короткий) + refresh (ротация! §39), httpOnly secure cookies + CSRF-strategy
- [x] 4.3 POST /api/auth/login|logout|refresh; GET /api/auth/me; remember me (§40)
- [x] 4.4 Роли SUPER_ADMIN/ADMIN/MANAGER/CONTENT_MANAGER/VIEWER + Permissions enum; Guards проверяют на backend (§7)
- [x] 4.5 CRUD users (SUPER_ADMIN/ADMIN) + assign role
- [x] 4.6 AuditLog записи на login/logout/role change (§38)
- [x] 4.7 Тесты: login happy/fail, refresh rotation, guard 401/403, RBAC матрица (§53)
- [x] 4.8 lint/typecheck/test ✅ → Commit «feat(phase4): auth + rbac»
- [x] 4.9 Admin UI авторизация: форма login (+remember me §40), API-клиент (access в памяти, refresh httpOnly-cookie, single-flight rotation), AuthGuard, восстановление сессии, logout, шапка с ролью; unit-тесты клиента

---

## PHASE 5 — TOURS (backend → frontend)

- [ ] 5.1 Slug-service: транслитерация RU→URL («Тур в Дагестан на 3 дня» → tur-v-dagestan-na-3-dnya), уникальность с суффиксами (§63)
- [ ] 5.2 Tours CRUD (§8, §47): GET /tours (пагинация, фильтры destination/city/date/duration/price/q, sort), GET /tours/:slug (published), POST/PATCH/DELETE(soft archive/trash) — RBAC
- [ ] 5.3 TourDay program CRUD (dayNumber, meals, overnight, sortOrder) (§9)
- [ ] 5.4 TourImage CRUD (url из storage, alt, isCover, sortOrder) (§10)
- [ ] 5.5 Destinations CRUD (§11) + DepartureCities CRUD (§13, редактируемо из админа)
- [ ] 5.6 SEO поля тура (metaTitle/metaDescription) + JSON-LD позже (Phase 13)
- [ ] 5.7 Pricing fields adultPrice/child10to14Price/childUnder10Price на Departure/Tour — цена только с backend (§17)
- [ ] 5.8 Media Library backend: upload→S3-compatible (presigned/POST), File metadata (filename, mimeType, size, width, height, url, alt, uploadedBy) (§41)
- [ ] 5.9 Тесты: slug unit, tour CRUD integration, RBAC guards; lint/typecheck/test ✅
- [ ] 5.10 Commit «feat(phase5): tours module + slug + media»

---

## PHASE 6 — DEPARTURES (+ transaction safety)

- [ ] 6.1 Departures CRUD (§12): startDate/endDate/totalSeats/price/status/notes/cities
- [ ] 6.2 availableSeats = totalSeats − сумма активных броней; пересчёт атомарно; статус ALMOST_FULL/FULL авто
- [ ] 6.3 Нельзя удалить/изменить выезд с активными бронями без процедуры (audit + confirmation)
- [ ] 6.4 Транзакции PostgreSQL + row locking (`SELECT ... FOR UPDATE`) на изменение seats (§54)
- [ ] 6.5 Integration test: конкурентное уменьшение мест (2 параллельных → один успех)
- [ ] 6.6 lint/typecheck/test ✅ → Commit «feat(phase6): departures + capacity»

---

## PHASE 7 — BOOKING (ядро бизнес-логики)

- [x] 7.1 POST /api/bookings (публичный, rate-limited): выбор departureId, cityId, adults, children10to14, childrenUnder10, контакты → NEW booking + Customer upsert (§14–15)
- [x] 7.2 Генерация bookingNumber (CT-YYYYMMDD-XXXX), ответ с номером заявки
- [x] 7.3 Anti-overselling: транзакция + блокировка строки Departure; проверка seats ≥ запрошенных; ошибка SEATS_INSUFFICIENT (§12, §54)
- [x] 7.4 Duplicate submission protection (идемпотентность: токен/уникальный ключ)
- [x] 7.5 BookingPassengers CRUD внутри брони (§16; без паспортных данных)
- [x] 7.6 Статус-машина Booking (9 статусов) + назначение менеджера + комментарии + BookingStatusHistory (§22, §38)
- [x] 7.7 GET /api/bookings/:id (публичная страница подтверждения по номеру — ограниченные данные), PATCH (staff)
- [x] 7.8 Событие booking.created → Notification manager (§15, Phase 11 feature-flag)
- [x] 7.9 Тесты: валидация, seat availability, overselling (unit-контракт транзакции; concurrency integration — требует живой PG, задокументировано), duplicate submit (§53–54)
- [x] 7.10 lint/typecheck/test ✅ → Commit «feat(phase7): booking engine»

---

## PHASE 8 — PUBLIC WEBSITE (Next.js)

- [x] 8.1 Структура страниц §26: /, /tours, /tours/[slug], /destinations, /destinations/[slug], /reviews, /about, /contacts, /faq, /booking/[id], /privacy, /terms, 404
- [x] 8.2 Home §27: Hero, популярные направления, ближайшие туры, преимущества, «как проходит поездка», отзывы, фото, FAQ, CTA «Выбрать тур»/«Забронировать», контакты — без перегруза
- [x] 8.3 Tour page §28: hero, цена/дата/места (с API), программа по дням, включено/не включено, города, галерея, FAQ, отзывы, ближайшие даты, CTA
- [x] 8.4 Catalog §29: поиск + фильтры (destination/date/duration/city/price) + sort; shareable URL query params
- [x] 8.5 Booking wizard §69: шаги дата→город→туристы→контакты→подтверждение; RHF+Zod (общие схемы из packages/validation), loading/success/error/empty states
- [x] 8.6 Reviews list + форма отзыва (PENDING до модерации, §24)
- [x] 8.7 FAQ accordion, About, Contacts, Legal (placeholder-поля, §59)
- [x] 8.8 Footer §58 + Telegram CTA «Задать вопрос в Telegram» из SiteSettings (§70)
- [ ] 8.9 Глобальный поиск §64 — отложен до Phase 13
- [x] 8.10 Responsive §42 (360/390/768/1024/1440/1920), accessibility §44 (semantic, focus, labels, alt, contrast)
- [x] 8.11 Централизованные translations/content (ru первый) §4
- [ ] 8.12 lint/typecheck/test (unit компонентов + Playwright E2E smoke) ✅ → Commit «feat(phase8): public site»

---

## PHASE 9 — ADMIN PANEL

- [ ] 9.1 /admin/login (email/password/remember), logout, refresh session (§40)
- [ ] 9.2 Sidebar §18: Dashboard, Tours, Departures, Destinations, Departure Cities, Bookings, Customers, Reviews, Telegram, Notifications, Media, FAQ, Promo Codes, Users, Settings, Audit Log
- [ ] 9.3 Dashboard §19: реальные метрики (новые заявки, сегодня, confirmed, paid, туристы, ближайшие выезды, заполняемость, выручка, последние действия, графики) + empty state при нуле
- [ ] 9.4 Tour management §20 (create/edit/archive/publish/program/photos reorder/destination/prices/SEO)
- [ ] 9.5 Departure management §21 (+ места/забронировано/свободно/% заполнения)
- [ ] 9.6 Booking management §22 (таблица: поиск/фильтры/сортировка/пагинация, просмотр, статус, менеджер, комментарий, история)
- [ ] 9.7 Customer CRM §23 (профиль, поездки, суммы, история, комментарии)
- [ ] 9.8 Reviews moderation (§24), FAQ CRUD (§25), Media library UI (§41: upload/delete/preview/search/copy URL/assign to tour)
- [ ] 9.9 Users & roles UI, Audit log viewer, Site settings §56 + content management §57 (hero, advantages, contacts, footer, socials)
- [ ] 9.10 Общие таблицы: pagination/sorting/filter/search/bulk-safe (§65); confirmation dialogs на удаление (§66); skeletons/spinners/disabled double-submit (§68)
- [ ] 9.11 Tablet usability (§42); tests (unit + E2E manager flow) ✅ → Commit «feat(phase9): admin panel»

---

## PHASE 10 — TELEGRAM

- [ ] 10.1 TelegramService (§31): sendMessage/sendPhoto/sendBookingNotification/sendStatusNotification/sendTourPublication/sendReminder; credentials только из env; логирование без токена
- [ ] 10.2 POST /api/telegram/webhook (§47) с проверкой secret-token; регистрация webhook при старте (feature flag)
- [ ] 10.3 Bot booking flow §32: направления→тур→дата→город→кол-во→телефон→Booking(source=TELEGRAM) в общей БД + inline-клавиатуры + FSM-состояния
- [ ] 10.4 Publication §33: «Опубликовать в Telegram» из админа → шаблон (§34: {{tour.title}}, {{departure.startDate}}, {{departure.price}}, {{departure.availableSeats}}, {{departure.cities}}, {{bookingUrl}}…) → фото + inline button → TelegramPost record + telegramMessageId
- [ ] 10.5 Template editor в админке + preview сообщения
- [ ] 10.6 Sync-получатель поста канала (TelegramPost как источник контента) — базовый ingest
- [ ] 10.7 Тесты: template render unit, publication service (mocked fetch), webhook signature; lint/typecheck/test ✅ → Commit «feat(phase10): telegram integration»

---

## PHASE 11 — NOTIFICATIONS

- [ ] 11.1 NotificationService: каналы EMAIL/TELEGRAM/SYSTEM, архитектура под SMS (§35); события booking.created/confirmed/cancelled/paid, departure.updated, departure.tomorrow
- [ ] 11.2 EmailService abstraction + provider-agnostic send() (§36); real SMTP only if env configured
- [ ] 11.3 Feature flags: реальные отправки только при конфигурации; иначе SYSTEM-запись + dry-run log (§55)
- [ ] 11.4 Scheduler (§55): напоминания за 7/1 день, просроченные заявки, закрытие прошедших выездов (cron в NestJS Schedule; флаг включения)
- [ ] 11.5 UI списка уведомлений в админке
- [ ] 11.6 Тесты unit/integration ✅ → Commit «feat(phase11): notifications + cron»

---

## PHASE 12 — ANALYTICS

- [ ] 12.1 Analytics abstraction (§71): события view_tour, select_departure, start_booking, booking_created, booking_confirmed, telegram_click, phone_click, review_submitted; без ПДн (§72)
- [ ] 12.2 Backend aggregation endpoints: bookings by day/tour/destination, revenue by month, customers by source, TG vs Website, conversion funnel (§73)
- [ ] 12.3 Дашборд-графики в админке (реальные данные из API)
- [ ] 12.4 Тесты агрегатов ✅ → Commit «feat(phase12): analytics»

---

## PHASE 13 — SEO

- [ ] 13.1 Metadata per page: title/description/canonical/OG/Twitter (§30) из SiteSettings defaults + per-tour overrides
- [ ] 13.2 sitemap.xml (динамический), robots.txt
- [ ] 13.3 JSON-LD: Organization, TouristTrip/Product, BreadcrumbList, FAQPage, AggregateRating (только реальные отзывы!)
- [ ] 13.4 Breadcrumbs UI + микроразметка; SEO URL §62 (/tours/[slug])
- [ ] 13.5 Проверка: отсутствие ложных данных; тесты metadata snapshot ✅ → Commit «feat(phase13): seo»

---

## PHASE 14 — TESTING (full pass)

- [ ] 14.1 Unit: auth, slug, pricing, templates, validation schemas
- [ ] 14.2 Integration: tour CRUD/update, departure creation, booking creation/validation, seat availability, **overselling concurrency**, review moderation, RBAC matrix, telegram publication
- [ ] 14.3 E2E Playwright (§53): visitor opens tour → creates booking → manager sees booking → changes status → customer notification recorded
- [ ] 14.4 Security checks: no secrets in FE/Git, headers, rate limit, XSS sanitize input, password hash never returned
- [ ] 14.5 Полный зелёный прогон: lint + typecheck + test + build → Commit «test(phase14): full suite»

---

## PHASE 15 — PERFORMANCE

- [ ] 15.1 Images: next/image, lazy loading, форматы WebP/AVIF, presigned uploads
- [ ] 15.2 SSR/ISR для каталога и туров; caching layer (query-level), индексы повторно проверить EXPLAIN
- [ ] 15.3 Bundle analysis web/admin; устранить реальные bottlenecks (§60, §15)
- [ ] 15.4 Lighthouse-профиль (desktop/mobile) — фиксация результатов в docs
- [ ] 15.5 Commit «perf(phase15)»

---

## PHASE 16 — PRODUCTION

- [ ] 16.1 Production Dockerfiles (multi-stage) для api/web/admin + compose prod override; healthchecks
- [ ] 16.2 `.env.production.example` (без секретов) + secrets policy
- [ ] 16.3 `/docs/DEPLOYMENT.md`: сборка, миграции (`prisma migrate deploy`), seed-off в prod, backup strategy (pg_dump cron + WAL/S3), rollback, Telegram webhook setup, legacy bot shutdown procedure
- [ ] 16.4 Logging/aggregation guidance + monitoring notes
- [ ] 16.5 Финальный чек определения готовности (§75) по всем функциям → Commit «chore(phase16): production readiness»

---

## СКВОЗНЫЕ ПРАВИЛА (действуют в каждой фазе)

1. Перед большим изменением — прочитать существующий код (§78).
2. После изменения — format → lint → typecheck → релевантные тесты → git diff.
3. Никаких TODO вместо реализации; никаких фейковых данных в production (§76).
4. Бизнес-логика — только backend/service layer (§1).
5. Секреты — только env (§1, §51).
6. После каждой фазы — отчёт формата §79 и запись статуса в этот PLAN.md.

## РЕЕСТР ОТКЛОНИЙ ОТ ТЗ (с обоснованием)

| # | Отклонение | Обоснование |
|---|------------|-------------|
| 1 | `/services/tgbot-legacy` вместо удаления Python-бота | §1: «не удаляй существующий рабочий функционал» |
| 2 | `prisma/` в корне monorepo | единая схема + seed/migrations из корня; стандарт для npm workspaces |
| 3 | npm workspaces + Turborepo | pnpm/yarn отсутствуют в среде; npm v10 нативные workspaces |
| 4 | Redis — в profiles, не обязателен | добавляется только при реальной необходимости (§52) |
