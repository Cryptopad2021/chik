# ЧиркейТур — деплой в production (фаза 16.3/16.4, ТЗ §75)

## 0. Требования к серверу
- Linux (Ubuntu 22.04+/Debian 12), 2 CPU / 4 GB RAM минимум
- Docker Engine 24+ и Docker Compose v2 (`docker compose`, не `docker-compose`)
- DNS: `WEB_DOMAIN` → IP сервера, `ADMIN_DOMAIN` → IP сервера (для Let's Encrypt через Caddy)
- Открытые порты наружу: только **80** и **443** (приложения привязаны к 127.0.0.1)

## 1. Получение кода
```bash
git clone <repo-url> /opt/chirkey && cd /opt/chirkey
git checkout main && git pull
```

## 2. Конфигурация окружения (без секретов в git!)
```bash
cp .env.production.example .env
chmod 600 .env
$EDITOR .env   # заполнить все CHANGE_ME; сгенерировать секреты:
#   openssl rand -base64 32   # для JWT_SECRET / JWT_REFRESH_SECRET / POSTGRES_PASSWORD / TELEGRAM_WEBHOOK_SECRET
```
**Secrets policy (ТЗ §39):**
- Секреты живут только в `.env` на сервере (chmod 600, владелец — deploy-пользователь).
- Ротация JWT_SECRET и Telegram-токена — каждые 90 дней или сразу при утечке.
- Заполненный `.env` никогда не коммитится (в `.gitignore`).

## 3. Сборка и запуск стека
```bash
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file .env up -d --build
```
Стек: postgres, redis, api (NestJS :3001), web (Next.js standalone :3000), admin (:3002), caddy (:80/:443, авто-HTTPS).
Healthcheck API: `GET /api/health` (учитывает состояние БД); контейнеры web/admin проверяют HTTP-корень.

## 4. Миграции базы (обязательно после каждого деплоя с новыми миграциями)
```bash
docker compose -f infrastructure/docker/docker-compose.prod.yml exec api \
  npx prisma migrate deploy
```
Миграции применяются строго вперёд; автоматического отката нет — перед миграцией делайте бэкап (шаг 7).

## 5. Первый администратор (один раз; seed демо-данных в prod НЕ выполняется — ТЗ §50)
```bash
docker compose -f infrastructure/docker/docker-compose.prod.yml exec api \
  sh -c "ADMIN_EMAIL=admin@chirkey.tour ADMIN_PASSWORD='strong-pass' npx ts-node prisma/seed.ts"
```
`prisma/seed.ts` создаёт реального SUPER_ADMIN из env и помечает любые демонстрационные записи `isDemo=true`.
Для prod рекомендуется выполнить seed один раз и при следующих деплоях миграций seed не повторять.
Переменная `SEED_DEMO` существует только для dev; в prod-стеке она не задаётся.

## 6. Telegram webhook setup (ТЗ §31–32)
1. В `.env`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (случайная строка 32+), `TELEGRAM_WEBHOOK_ENABLED=true`.
2. Перезапустить api: `... up -d api` — бот сам зарегистрирует webhook (`setWebhook` с secret-token) при старте.
3. Проверка: `curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"` — URL = `https://<WEB_DOMAIN>/api/telegram/webhook`, `pending_update_count` ≈ 0.
4. Канал: бот должен быть админом канала `TELEGRAM_CHANNEL_ID`; ingest forwarding-сообщений работает через тот же webhook.

### Legacy bot shutdown procedure (ТЗ: старый Python-бот в services/tgbot-legacy)
Старый бот использует **тот же токен**, поэтому одновременно работать два бота не могут:
1. Остановить legacy-сервис: `sudo systemctl stop tgbot && sudo systemctl disable tgbot` (или `docker compose -f services/tgbot-legacy/docker-compose.yml down`).
2. Убедиться, что токен больше нигде не используется (`getWebhookInfo` показывает новый webhook).
3. Только после этого включать `TELEGRAM_WEBHOOK_ENABLED=true` для нового NestJS-бота.
4. Данные legacy-бота (SQLite/Postgres users) не мигрируются — новые чаты начинают работу с нуля (FSM в Redis/PG).

## 7. Backup strategy
**pg_dump по cron (ежедневно, хранение 14 дней):**
```bash
# /etc/cron.d/chirkey-backup
0 3 * * * root docker exec chirkey-pg pg_dump -U chirkey -Fc chirkey_tour > /var/backups/chirkey/db-$(date +\%F-\%H\%M).dump
30 3 * * * root docker run --rm -v /var/backups/chirkey:/b alpine find /b -name '*.dump' -mtime +14 -delete
```
- Медиа (volume `media`): `docker run --rm -v chirkey-prod_media:/m -v /var/backups/chirkey:/b alpine tar czf /b/media-$(date +%F).tgz -C /m .`
- Опционально WAL-архив / выгрузка дампов в S3 (`aws s3 cp` / rclone) для off-site хранения.
- **Restore:** `docker exec -i chirkey-pg pg_restore -U chirkey -d chirkey_tour --clean --if-exists < db-YYYY-MM-DD.dump` + миграции поверх.
- Раз в квартал проверять восстановление дампа на тестовой машине.

## 8. Rollback
Приложение (stateless-образы):
```bash
git checkout <prev-tag> && docker compose -f infrastructure/docker/docker-compose.prod.yml up -d --build api web admin
```
Если новая миграция несовместима со старой версией кода — восстановить БД из дампа шага 7 до точки before-deploy, затем откатывать код. Правило: миграции обратно не откатывать (`migrate rollback` не использовать), вместо этого restore из backup.

## 9. Обновление (обычный цикл релиза)
```bash
cd /opt/chirkey && git pull
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file .env up -d --build
docker compose -f infrastructure/docker/docker-compose.prod.yml exec api npx prisma migrate deploy
```
Простой даунтайм: секунды (restart unless-stopped + healthchecks).

## 10. Logging & monitoring (фаза 16.4)
- **Логи**: логи приложений идут в stdout контейнеров. Ротацию задать в `/etc/docker/daemon.json`: `{"log-driver":"json-file","log-opts":{"max-size":"50m","max-file":"10"}}`.
- Просмотр: `docker logs -f chirkey-api --since 1h`; фильтрация ошибок: `grep '"level":"error"'`.
- **Агрегация (рекоменд.)**: self-hosted Grafana Loki + Promtail (легковесно для 1 VPS) или Uptime Kuma для внешних проверок. Подключение: promtail читает `/var/lib/docker/containers/*/*-json.log`.
- **Метрики**: эндпоинт `/api/health` — liveness (код 200 + `db:up`); мониторить externally (UptimeRobot/Better Stack, проверка каждые 60 с). Алерты: health != ok > 2 мин, свободный диск < 15%, место под volume media.
- **Безопасность-наблюдение**: audit-лог (таблица `AuditLog`) пишется на все админ-действия; rate-limit события видны в логах (`ThrottlerException`); входные попытки — `/api/auth` лимит 20/15 мин.
- Бэкапы считать успешными только при непустом файле свежей даты (cron-скрипт может слать уведомление в Telegram-канал админа через `curl -T`).

## 11. Чек-лист готовности (ТЗ §75)
см. финальный раздел `docs/PLAN.md` — «Финальная приёмка».
