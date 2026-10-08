/* eslint-disable no-console */
/**
 * Seed для ЧиркейТур (ТЗ §50).
 * ВСЕ демонстрационные данные помечены isDemo=true — их нельзя выдавать за реальные.
 * Реальный администратор создаётся из env: ADMIN_EMAIL / ADMIN_PASSWORD (без дефолтного пароля!).
 *
 * Запуск: npm run seed  (требует доступный PostgreSQL)
 */
import { PrismaClient, BookingStatus, TourStatus, UserRole } from '@prisma/client';
import { hash } from 'argon2';
import { slugify } from '../apps/api/src/common/slug';

const prisma = new PrismaClient();

const DEMO_TAG = 'demo:seed';

async function main() {
  // 1) Направления (§11)
  const destinationsData = [
    { name: 'Дагестан', description: 'Горы, аулы и барханы Дагестана' },
    { name: 'Осетия', description: 'Кармадон, Даргавс и горные ущелья' },
    { name: 'Чечня', description: 'Грозный, Аргунское ущелье, башни Вайнах' },
    { name: 'Ингушетия', description: 'Башенные комплексы и Джейрахско-Ассинский заповедник' },
    { name: 'Кавказ', description: 'Многодневные маршруты по всему Кавказу' },
  ];
  const destinations: Record<string, string> = {};
  for (const d of destinationsData) {
    const slug = slugify(d.name);
    const rec = await prisma.destination.upsert({
      where: { slug },
      update: {},
      create: { slug, name: d.name, description: d.description, isDemo: true },
    });
    destinations[d.name] = rec.id;
  }

  // 2) Города отправления (§13)
  const citiesData = [
    'Ростов-на-Дону',
    'Таганрог',
    'Мариуполь',
    'Бердянск',
    'Приморск',
    'Мелитополь',
    'Геническ',
  ];
  const cities: Record<string, string> = {};
  for (const [i, name] of citiesData.entries()) {
    const slug = slugify(name);
    const rec = await prisma.departureCity.upsert({
      where: { slug },
      update: {},
      create: { slug, name, sortOrder: i, isActive: true, isDemo: true },
    });
    cities[name] = rec.id;
  }

  // 3) Тур «Тур в Дагестан на 3 дня» + программа (§8–9)
  const tourSlug = 'tur-v-dagestan-na-3-dnya';
  const tour = await prisma.tour.upsert({
    where: { slug: tourSlug },
    update: {},
    create: {
      slug: tourSlug,
      title: 'Тур в Дагестан на 3 дня',
      shortDescription: 'Сулакский каньон, Бархан Сарыкум, древний аул Габутиум.',
      description:
        'Трёхдневное путешествие по южному Дагестану: смотровые площадки Сулакского каньона, пустыня Сарыкум, старый город Дербента и горы.',
      destinationId: destinations['Дагестан'],
      durationDays: 3,
      durationNights: 2,
      basePrice: 18500,
      currency: 'RUB',
      status: TourStatus.PUBLISHED,
      adultPrice: 18500,
      child10to14Price: 16500,
      childUnder10Price: 14500,
      metaTitle: 'Тур в Дагестан на 3 дня — ЧиркейТур',
      metaDescription: 'Автобусный тур выходного дня в Дагестан из Ростовской области.',
      includedText: 'Транспорт, гид, 2 ночи в гостинице, экскурсии по программе',
      notIncludedText: 'Питание, личные расходы, входные билеты в платные объекты',
      isDemo: true,
    },
  });

  const days = [
    { dayNumber: 1, title: 'Сулакский каньон', description: 'Выезд из Ростова-на-Дону утром. Сулакская крепость, смотровые площадки каньона, Чиркейское водохранилище.', meals: '—', overnight: true },
    { dayNumber: 2, title: 'Дербент', description: 'Бархан Сарыкум, древний Дербент: крепость Нарын-Кала, магалы, Джума-мечеть.', meals: 'завтрак', overnight: true },
    { dayNumber: 3, title: 'Габутиум и дорога домой', description: 'Аул Габутиум, бархан (по погоде), выезд домой, прибытие вечером.', meals: 'завтрак', overnight: false },
  ];
  for (const d of days) {
    await prisma.tourDay.upsert({
      where: { tourId_dayNumber: { tourId: tour.id, dayNumber: d.dayNumber } },
      update: {},
      create: { ...d, tourId: tour.id, sortOrder: d.dayNumber },
    });
  }

  // 4) Выезд с городами (§12, §21)
  const depStart = new Date();
  depStart.setDate(depStart.getDate() + 21);
  const depEnd = new Date(depStart);
  depEnd.setDate(depEnd.getDate() + 2);
  let departure = await prisma.departure.findFirst({
    where: { tourId: tour.id, startDate: { gte: new Date() } },
  });
  if (!departure) {
    departure = await prisma.departure.create({
      data: {
        tourId: tour.id,
        startDate: depStart,
        endDate: depEnd,
        totalSeats: 40,
        price: 18500,
        status: 'OPEN',
        isDemo: true,
        cities: {
          create: ['Ростов-на-Дону', 'Таганрог', 'Мелитополь'].map((c) => ({
            departureCityId: cities[c],
          })),
        },
      },
    });
  }

  // 5) Демо-клиенты и брони (§6, §14)
  const customerSeed = { firstName: 'Иван', lastName: 'Демонов', phone: '+79000000000', email: 'demo@example.com', isDemo: true };
  const cust = await prisma.customer.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: { ...customerSeed, id: '00000000-0000-4000-8000-000000000001' },
  });
  const bookingNumber = `DEMO-${Date.now().toString().slice(-6)}`;
  const existingBooking = await prisma.booking.findFirst({ where: { customerId: cust.id, departureId: departure.id } });
  if (!existingBooking) {
    await prisma.booking.create({
      data: {
        bookingNumber,
        customerId: cust.id,
        departureId: departure.id,
        departureCityId: cities['Ростов-на-Дону'],
        status: BookingStatus.NEW,
        adults: 2,
        children10to14: 0,
        childrenUnder10: 0,
        totalAmount: 37000,
        currency: 'RUB',
        source: 'WEBSITE',
        comment: DEMO_TAG,
        passengers: {
          create: [
            { firstName: 'Иван', lastName: 'Демонов', passengerType: 'ADULT' },
            { firstName: 'Мария', lastName: 'Демонова', passengerType: 'ADULT' },
          ],
        },
      },
    });
    await prisma.$executeRaw`UPDATE "Departure" SET "bookedSeats" = "bookedSeats" + 2 WHERE id = ${departure.id}::uuid`;
  }

  // 6) Отзывы (помечены demo!) (§24, §76 — никаких фальшивых отзывов под видом реальных)
  const existingReview = await prisma.review.findFirst({ where: { tourId: tour.id, authorName: 'Демо-турист' } });
  if (!existingReview) {
    await prisma.review.create({
      data: {
        tourId: tour.id,
        customerId: cust.id,
        authorName: 'Демо-турист',
        rating: 5,
        text: 'ДЕМО-отзыв для тестирования модерации. Не является реальным отзывом клиента.',
        status: 'PENDING',
      },
    });
  }

  // 7) FAQ (§25)
  const faqs = [
    { question: 'Как забронировать тур?', answer: 'Выберите тур и дату на сайте или напишите нам в Telegram — менеджер подтвердит наличие мест.', category: 'booking' },
    { question: 'Что взять с собой в горный тур?', answer: 'Удобную обувь, тёплую кофту (в горах прохладно даже летом), документы и зарядное устройство.', category: 'general' },
    { question: 'Можно ли с детьми?', answer: 'Да, для детей до 10 лет действует специальная цена. Ограничения указаны в описании каждого тура.', category: 'general' },
  ];
  for (const f of faqs) {
    const exists = await prisma.faq.findFirst({ where: { question: f.question } });
    if (!exists) await prisma.faq.create({ data: { ...f, isPublished: true, sortOrder: faqs.indexOf(f) } });
  }

  // 8) Настройки сайта (§56) — только если ещё не созданы
  const settings = await prisma.siteSettings.findFirst();
  if (!settings) {
    await prisma.siteSettings.create({
      data: {
        companyName: 'ЧиркейТур',
        phone: '',
        email: '',
        telegramUrl: 'https://t.me/chirkey_tour3',
        seoDefaultTitle: 'ЧиркейТур — туры по Кавказу',
        seoDefaultDescription: 'Групповые автобусные туры в Дагестан, Осетию, Чечню и Ингушетию.',
      },
    });
  }

  // 9) Администратор — ТОЛЬКО из env, без захардкоженного пароля (§76)
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const exists = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!exists) {
      await prisma.user.create({
        data: { email: adminEmail, passwordHash: await hash(adminPassword), role: UserRole.SUPER_ADMIN, firstName: 'Администратор', lastName: 'ЧиркейТур' },
      });
      console.log(`Created admin user ${adminEmail}`);
    }
  } else {
    console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin creation (no hardcoded credentials).');
  }

  console.log('Seed complete. Demo data is marked with isDemo=true / comment="demo:seed".');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
