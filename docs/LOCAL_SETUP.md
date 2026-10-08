# Запуск ЧиркейТур на локальном компьютере

## Требования
- Node.js >= 20, npm >= 10
- Docker Desktop (для PostgreSQL) — либо локальный PostgreSQL 14+

## 1. Получение кода
Вариант А — git bundle (рекомендуется, пока нет GitHub-remote):
```bash
git clone chirkey-clean.bundle chirkey-tour
cd chirkey-tour
git checkout -b main
```
Вариант Б — push в ваш репозиторий GitHub:
```bash
git remote add origin https://github.com/<you>/chirkey-tour.git
git push -u origin HEAD:main
git clone https://github.com/<you>/chirkey-tour.git
```

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
