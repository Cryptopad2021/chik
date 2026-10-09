import { describe, it, expect, beforeEach } from 'vitest';
import { ToursService } from './tours.service';

/**
 * Phase 5.9: unit-тесты tours CRUD без БД (PostgreSQL недоступен в dev).
 * Prisma подменяется in-memory заглушкой; проверяем бизнес-правила:
 * replace-семантика дней/галереи, уникальность dayNumber, правило обложки (§9, §10).
 */

type Row = Record<string, unknown>;
/** Аргументы вызовов заглушки Prisma (структура известна только тесту). */
type Arg = unknown;
/** In-memory заглушка PrismaService: достаточно методов для replaceDays/replaceImages. */
type DbStub = unknown;

function makeDb() {
  const tourDay: Row[] = [];
  const tourImage: Row[] = [];
  let idSeq = 1;
  const nextId = () => `id_${idSeq++}`;

  const db = {
    _tourDay: tourDay,
    _tourImage: tourImage,
    isHealthy: () => true,
    tour: {
      findFirst: async ({ where }: Arg) =>
        where?.deletedAt === null ? { id: 'tour1', title: 'Тур' } : null,
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    tourDay: {
      deleteMany: async ({ where }: Arg) => {
        for (let i = tourDay.length - 1; i >= 0; i--) {
          if (tourDay[i].tourId === where.tourId) tourDay.splice(i, 1);
        }
        return { count: 1 };
      },
      createMany: async ({ data }: Arg) => {
        const rows = Array.isArray(data) ? data : [data];
        for (const r of rows) tourDay.push({ ...r, id: nextId() });
        return { count: rows.length };
      },
      findMany: async ({ where, orderBy }: Arg) => {
        const rows = tourDay.filter((d) => d.tourId === where.tourId);
        if (orderBy?.sortOrder === 'asc')
          rows.sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
        return rows;
      },
    },
    tourImage: {
      deleteMany: async ({ where }: Arg) => {
        for (let i = tourImage.length - 1; i >= 0; i--) {
          if (tourImage[i].tourId === where.tourId) tourImage.splice(i, 1);
        }
        return { count: 1 };
      },
      createMany: async ({ data }: Arg) => {
        const rows = Array.isArray(data) ? data : [data];
        for (const r of rows) tourImage.push({ ...r, id: nextId() });
        return { count: rows.length };
      },
      findMany: async ({ where, orderBy }: Arg) => {
        const rows = tourImage.filter((d) => d.tourId === where.tourId);
        if (orderBy?.sortOrder === 'asc')
          rows.sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
        return rows;
      },
    },
  };
  return db as unknown as DbStub;
}

describe('ToursService — программа тура (§9)', () => {
  let db: DbStub;
  let svc: ToursService;

  beforeEach(() => {
    db = makeDb();
    // AuditService в этих методах не используется — бросаем пустой стаб
    svc = new ToursService(db as never);
  });

  it('replaceDays заменяет программу целиком и проставляет sortOrder по индексу', async () => {
    await svc.replaceDays('tour1', [
      { dayNumber: 1, title: 'Прилёт', description: 'Встреча' },
      { dayNumber: 2, title: 'Горы', description: 'Трекинг', meals: 'завтрак, ужин', overnight: true },
    ]);
    expect(db._tourDay).toHaveLength(2);
    expect(db._tourDay[0]).toMatchObject({ dayNumber: 1, sortOrder: 1 });
    expect(db._tourDay[1]).toMatchObject({ dayNumber: 2, sortOrder: 2, meals: 'завтрак, ужин', overnight: true });

    await svc.replaceDays('tour1', [{ dayNumber: 1, title: 'Новый день', description: 'X' }]);
    expect(db._tourDay).toHaveLength(1);
    expect(db._tourDay[0]).toMatchObject({ dayNumber: 1, title: 'Новый день' });
  });

  it('replaceDays отклоняет дублирующиеся dayNumber до записи (§9 unique)', async () => {
    await expect(
      svc.replaceDays('tour1', [
        { dayNumber: 1, title: 'A', description: 'x' },
        { dayNumber: 1, title: 'B', description: 'y' },
      ]),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(db._tourDay).toHaveLength(0);
  });

  it('replaceDays на несуществующем туре → TOUR_NOT_FOUND 404', async () => {
    db.tour.findFirst = async () => null;
    await expect(
      svc.replaceDays('missing', [{ dayNumber: 1, title: 'A', description: 'x' }]),
    ).rejects.toMatchObject({ code: 'TOUR_NOT_FOUND', status: 404 });
  });
});

describe('ToursService — галерея тура (§10)', () => {
  let db: DbStub;
  let svc: ToursService;

  beforeEach(() => {
    db = makeDb();
    svc = new ToursService(db as never);
  });

  it('ровно одна обложка: первая с isCover=true', async () => {
    await svc.replaceImages('tour1', [
      { url: '/media/a.jpg', alt: 'a' },
      { url: '/media/b.jpg', alt: 'b', isCover: true },
      { url: '/media/c.jpg', alt: 'c', isCover: true },
    ]);
    const covers = db._tourImage.filter((r) => r.isCover);
    expect(covers).toHaveLength(1);
    expect(covers[0].url).toBe('/media/b.jpg');
  });

  it('если обложка не отмечена — cover становится первый элемент', async () => {
    await svc.replaceImages('tour1', [
      { url: '/media/x.jpg', alt: 'x' },
      { url: '/media/y.jpg', alt: 'y' },
    ]);
    expect(db._tourImage[0]).toMatchObject({ url: '/media/x.jpg', isCover: true });
    expect(db._tourImage[1].isCover).toBe(false);
  });

  it('replace очищает старые изображения', async () => {
    await svc.replaceImages('tour1', [{ url: '/media/old.jpg', alt: 'o' }]);
    await svc.replaceImages('tour1', [{ url: '/media/new.jpg', alt: 'n' }]);
    expect(db._tourImage).toHaveLength(1);
    expect(db._tourImage[0].url).toBe('/media/new.jpg');
  });
});
