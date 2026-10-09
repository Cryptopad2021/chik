import { Injectable } from '@nestjs/common';
import { Prisma, DepartureStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { uniqueSlug } from '../../common/slug';
import { AppException } from '../../common/app-exception';
import { CreateTourDto, UpdateTourDto, ListToursQuery, TourDayDto, TourImageDto } from './dto';

@Injectable()
export class ToursService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    if (!this.prisma.isHealthy()) throw AppException.databaseUnavailable();
    return this.prisma;
  }

  async list(query: ListToursQuery) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(50, Math.max(1, query.perPage ?? 12));
    const where: Prisma.TourWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    else where.status = 'PUBLISHED'; // публичный каталог видит только опубликованное
    if (query.destination) where.destination = { slug: query.destination };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.minPrice != null || query.maxPrice != null) {
      where.basePrice = {};
      if (query.minPrice != null) where.basePrice.gte = query.minPrice;
      if (query.maxPrice != null) where.basePrice.lte = query.maxPrice;
    }
    if (query.durationDays != null) where.durationDays = query.durationDays;

    const dateFilter: Prisma.DateTimeFilter | undefined =
      query.dateFrom || query.dateTo
        ? { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}) }
        : undefined;
    const openStatuses: { in: DepartureStatus[] } = { in: ['OPEN', 'ALMOST_FULL'] };
    if (query.city) {
      where.departures = {
        some: {
          status: openStatuses,
          ...(dateFilter ? { startDate: dateFilter } : {}),
          cities: { some: { departureCity: { slug: query.city, isActive: true } } },
        },
      };
    } else if (dateFilter) {
      where.departures = { some: { status: openStatuses, startDate: dateFilter } };
    }

    const orderBy: Prisma.TourOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { basePrice: 'asc' }
        : query.sort === 'price_desc'
          ? { basePrice: 'desc' }
          : query.sort === 'newest'
            ? { createdAt: 'desc' }
            : { title: 'asc' };

    const [tours, total] = await Promise.all([
      this.db.tour.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          destination: { select: { id: true, name: true, slug: true } },
          images: { where: { isCover: true }, take: 1 },
          _count: { select: { departures: true } },
        },
      }),
      this.db.tour.count({ where }),
    ]);

    // Ближайший открытый выезд для каждого тура — одним extra-запросом (без N+1).
    const ids = tours.map((t) => t.id);
    const nextMap = new Map<string, { id: string; startDate: Date; endDate: Date | null; availableSeats: number; price: number }>();
    if (ids.length > 0) {
      const deps = await this.db.departure.findMany({
        where: { tourId: { in: ids }, status: { in: ['OPEN', 'ALMOST_FULL'] } },
        orderBy: { startDate: 'asc' },
        select: { id: true, tourId: true, startDate: true, endDate: true, totalSeats: true, bookedSeats: true, price: true },
      });
      for (const d of deps) {
        if (!nextMap.has(d.tourId)) {
          nextMap.set(d.tourId, {
            id: d.id,
            startDate: d.startDate,
            endDate: d.endDate,
            availableSeats: Math.max(d.totalSeats - d.bookedSeats, 0),
            price: Number(d.price),
          });
        }
      }
    }

    const items = tours.map((t) => ({
      ...t,
      coverImage: t.images[0]?.url ?? null,
      nextDeparture: nextMap.get(t.id) ?? null,
    }));
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  }

  async bySlug(slug: string) {
    const tour = await this.db.tour.findFirst({
      where: { slug, deletedAt: null },
      include: {
        destination: true,
        days: { orderBy: { sortOrder: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
        reviews: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { customer: { select: { firstName: true, lastName: true } } },
        },
        departures: {
          where: { status: { in: ['OPEN', 'ALMOST_FULL'] } },
          orderBy: { startDate: 'asc' },
          include: { cities: { include: { departureCity: true } } },
        },
      },
    });
    if (!tour) throw new AppException('TOUR_NOT_FOUND', 'Тур не найден', 404);
    // Публичная страница: только опубликованные туры (DRAFT/ARCHIVED скрыты, ТЗ §8)
    if (tour.status !== 'PUBLISHED') throw new AppException('TOUR_NOT_FOUND', 'Тур не найден', 404);
    const cover = tour.images.find((i) => i.isCover) ?? tour.images[0];
    const firstOpen = tour.departures[0];
    return {
      ...tour,
      coverImage: cover?.url ?? null,
      nextDeparture: firstOpen
        ? {
            id: firstOpen.id,
            startDate: firstOpen.startDate,
            endDate: firstOpen.endDate,
            availableSeats: Math.max(firstOpen.totalSeats - firstOpen.bookedSeats, 0),
            price: firstOpen.price,
          }
        : null,
      departures: tour.departures.map((d) => ({
        ...d,
        availableSeats: Math.max(d.totalSeats - d.bookedSeats, 0),
        cities: d.cities.map((c) => c.departureCity),
      })),
    };
  }

  async create(dto: CreateTourDto) {
    const slug = await uniqueSlug(dto.title, async (s) => !!(await this.db.tour.findFirst({ where: { slug: s, deletedAt: null }, select: { id: true } })));
    const tour = await this.db.tour.create({
      data: {
        slug,
        title: dto.title,
        shortDescription: dto.shortDescription,
        description: dto.description,
        destinationId: dto.destinationId,
        durationDays: dto.durationDays,
        durationNights: dto.durationNights,
        basePrice: dto.basePrice,
        currency: dto.currency ?? 'RUB',
        status: dto.status ?? 'DRAFT',
        adultPrice: dto.adultPrice,
        child10to14Price: dto.child10to14Price,
        childUnder10Price: dto.childUnder10Price,
        metaTitle: dto.metaTitle ?? null,
        metaDescription: dto.metaDescription ?? null,
        includedText: dto.includedText ?? null,
        notIncludedText: dto.notIncludedText ?? null,
        days: dto.days?.length
          ? { create: dto.days.map((d, i) => ({ ...d, sortOrder: d.sortOrder ?? i + 1 })) }
          : undefined,
      },
      include: { days: true },
    });
    return tour;
  }

  async update(id: string, dto: UpdateTourDto) {
    await this.getOr404(id);
    const data: Prisma.TourUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.shortDescription !== undefined) data.shortDescription = dto.shortDescription;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.destinationId !== undefined) data.destination = { connect: { id: dto.destinationId } };
    if (dto.durationDays !== undefined) data.durationDays = dto.durationDays;
    if (dto.durationNights !== undefined) data.durationNights = dto.durationNights;
    if (dto.basePrice !== undefined) data.basePrice = dto.basePrice;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.adultPrice !== undefined) data.adultPrice = dto.adultPrice;
    if (dto.child10to14Price !== undefined) data.child10to14Price = dto.child10to14Price;
    if (dto.childUnder10Price !== undefined) data.childUnder10Price = dto.childUnder10Price;
    if (dto.metaTitle !== undefined) data.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined) data.metaDescription = dto.metaDescription;
    if (dto.includedText !== undefined) data.includedText = dto.includedText;
    if (dto.notIncludedText !== undefined) data.notIncludedText = dto.notIncludedText;
    return this.db.tour.update({ where: { id }, data });
  }

  /** Архивирование = soft delete (ТЗ §8 deletedAt). Физическое удаление не предоставляем. */
  async archive(id: string) {
    await this.getOr404(id);
    return this.db.tour.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
  }

  /**
   * Программа тура (§9): replace-семантика — целиком заменяем дни одним запросом.
   * dayNumber уникален в рамках тура (@@unique([tourId, dayNumber]) в схеме),
   * поэтому дубликаты отсекаем до записи.
   */
  async replaceDays(tourId: string, days: TourDayDto[]) {
    await this.getOr404(tourId);
    const numbers = days.map((d) => d.dayNumber);
    if (new Set(numbers).size !== numbers.length) {
      throw AppException.validation('Дублирующиеся dayNumber в программе тура');
    }
    await this.$transaction([
      this.db.tourDay.deleteMany({ where: { tourId } }),
      this.db.tourDay.createMany({
        data: days.map((d, i) => ({
          tourId,
          dayNumber: d.dayNumber,
          title: d.title,
          description: d.description,
          meals: d.meals ?? null,
          overnight: d.overnight ?? false,
          sortOrder: d.sortOrder ?? i + 1,
        })),
      }),
    ]);
    return this.db.tourDay.findMany({ where: { tourId }, orderBy: { sortOrder: 'asc' } });
  }

  /**
   * Галерея тура (§10): replace-семантика. Ровно одна обложка — первая с isCover,
   * если ни одна не отмечена, cover становится первый элемент списка.
   */
  async replaceImages(tourId: string, images: TourImageDto[]) {
    await this.getOr404(tourId);
    const rows = images.map((img, i) => ({
      tourId,
      url: img.url,
      alt: img.alt,
      title: img.title ?? null,
      fileId: img.fileId ?? null,
      sortOrder: img.sortOrder ?? i + 1,
      isCover: false,
    }));
    let coverIdx = rows.findIndex((_r, i) => images[i].isCover === true);
    if (coverIdx < 0 && rows.length > 0) coverIdx = 0;
    if (coverIdx >= 0) rows[coverIdx].isCover = true;

    await this.$transaction([
      this.db.tourImage.deleteMany({ where: { tourId } }),
      ...(rows.length ? [this.db.tourImage.createMany({ data: rows })] : []),
    ]);
    return this.db.tourImage.findMany({ where: { tourId }, orderBy: { sortOrder: 'asc' } });
  }

  private $transaction<T>(ops: Promise<T>[]): Promise<T[]> {
    // PrismaService проксирует транзакции; при недоступной БД db-геттер уже бросает 503
    return this.db.$transaction(ops as never) as Promise<T[]>;
  }

  private async getOr404(id: string) {
    const tour = await this.db.tour.findFirst({ where: { id, deletedAt: null } });
    if (!tour) throw new AppException('TOUR_NOT_FOUND', 'Тур не найден', 404);
    return tour;
  }
}
