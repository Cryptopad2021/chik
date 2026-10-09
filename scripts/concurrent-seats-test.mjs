#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * PHASE 6.5 — интеграционный тест конкурентного уменьшения мест (ТЗ §54).
 * Требует живой PostgreSQL + запущенный API (см. docker-compose.yml).
 *
 * Сценарий: выезд на 2 места, два параллельных POST /api/bookings по 2 места.
 * Ожидаем: ровно один успех (201/200), второй получает SEATS_INSUFFICIENT (409).
 * После прогона bookedSeats === 2 (не больше!) — overselling невозможен.
 *
 * Запуск: DATABASE_URL=... API_URL=http://localhost:3001 node scripts/concurrent-seats-test.mjs
 */
const { PrismaClient } = require('@prisma/client');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

async function main() {
  // 1. Подготовка: берём первый активный тур и город отправления (или создаём минимальные данные)
  let tour = await prisma.tour.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } });
  if (!tour) {
    const destination =
      (await prisma.destination.findFirst()) ||
      (await prisma.destination.create({ data: { name: 'Test Dest', slug: 'test-dest-concurrent' } }));
    tour = await prisma.tour.create({
      data: {
        title: 'Concurrency Test Tour',
        slug: 'concurrency-test-tour-' + Date.now(),
        destinationId: destination.id,
        basePrice: 1000,
        durationDays: 1,
        difficulty: 'EASY',
        status: 'ACTIVE',
      },
    });
  }
  const city =
    (await prisma.departureCity.findFirst({ where: { isActive: true } })) ||
    (await prisma.departureCity.create({ data: { name: 'Test City', slug: 'test-city-' + Date.now(), isActive: true } }));

  const departure = await prisma.departure.create({
    data: { tourId: tour.id, startDate: new Date(Date.now() + 30 * 864e5), endDate: new Date(Date.now() + 31 * 864e5), totalSeats: 2, price: 1000, status: 'OPEN' },
  });
  await prisma.departureCityOnDeparture.create({ data: { departureId: departure.id, departureCityId: city.id, price: 1000 } });

  console.log(`Prepared departure ${departure.id} with 2 seats`);

  // 2. Два параллельных запроса на бронь по 2 места каждый
  const mkBody = (tag) => ({
    departureId: departure.id,
    departureCityId: city.id,
    customer: { firstName: `User${tag}`, lastName: 'Test', phone: `+7900000000${tag}` },
    adults: 2,
    children10to14: 0,
    childrenUnder10: 0,
    passengers: [
      { firstName: `P1${tag}`, lastName: 'Test', passengerType: 'ADULT' },
      { firstName: `P2${tag}`, lastName: 'Test', passengerType: 'ADULT' },
    ],
    source: 'WEBSITE',
    idempotencyKey: `concurrent-${departure.id}-${tag}`,
  });

  const results = await Promise.allSettled(
    ['A', 'B'].map(async (tag) => {
      const res = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mkBody(tag)),
      });
      const json = await res.json().catch(() => ({}));
      return { tag, status: res.status, code: json?.code };
    }),
  );

  const outcomes = results.map((r) => (r.status === 'fulfilled' ? r.value : { tag: '?', status: -1, code: 'NETWORK' }));
  console.log('Outcomes:', JSON.stringify(outcomes, null, 2));

  const okCount = outcomes.filter((o) => o.status >= 200 && o.status < 300).length;
  const conflictCount = outcomes.filter((o) => o.code === 'SEATS_INSUFFICIENT').length;

  // 3. Финальная сверка состояния БД
  const final = await prisma.departure.findUnique({ where: { id: departure.id }, select: { bookedSeats: true, status: true } });
  console.log(`Final DB state: bookedSeats=${final?.bookedSeats}, status=${final?.status}`);

  // 4. Очистка тестовых данных
  await prisma.booking.deleteMany({ where: { departureId: departure.id } });
  await prisma.departureCityOnDeparture.deleteMany({ where: { departureId: departure.id } });
  await prisma.departure.delete({ where: { id: departure.id } });

  const pass = okCount === 1 && conflictCount === 1 && final?.bookedSeats === 2;
  console.log(pass ? 'PASS: no oversell, exactly one booking succeeded' : `FAIL: ok=${okCount} conflicts=${conflictCount} booked=${final?.bookedSeats}`);
  process.exitCode = pass ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
