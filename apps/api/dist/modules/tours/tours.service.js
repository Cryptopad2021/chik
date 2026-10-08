"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToursService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const slug_1 = require("../../common/slug");
const app_exception_1 = require("../../common/app-exception");
let ToursService = class ToursService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    get db() {
        if (!this.prisma.isHealthy())
            throw app_exception_1.AppException.databaseUnavailable();
        return this.prisma;
    }
    async list(query) {
        const page = Math.max(1, query.page ?? 1);
        const perPage = Math.min(50, Math.max(1, query.perPage ?? 12));
        const where = { deletedAt: null };
        if (query.status)
            where.status = query.status;
        else
            where.status = 'PUBLISHED'; // публичный каталог видит только опубликованное
        if (query.destination)
            where.destination = { slug: query.destination };
        if (query.search) {
            where.OR = [
                { title: { contains: query.search, mode: 'insensitive' } },
                { shortDescription: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        if (query.minPrice != null || query.maxPrice != null) {
            where.basePrice = {};
            if (query.minPrice != null)
                where.basePrice.gte = query.minPrice;
            if (query.maxPrice != null)
                where.basePrice.lte = query.maxPrice;
        }
        if (query.durationDays != null)
            where.durationDays = query.durationDays;
        const dateFilter = query.dateFrom || query.dateTo
            ? { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}) }
            : undefined;
        const openStatuses = { in: ['OPEN', 'ALMOST_FULL'] };
        if (query.city) {
            where.departures = {
                some: {
                    status: openStatuses,
                    ...(dateFilter ? { startDate: dateFilter } : {}),
                    cities: { some: { departureCity: { slug: query.city, isActive: true } } },
                },
            };
        }
        else if (dateFilter) {
            where.departures = { some: { status: openStatuses, startDate: dateFilter } };
        }
        const orderBy = query.sort === 'price_asc'
            ? { basePrice: 'asc' }
            : query.sort === 'price_desc'
                ? { basePrice: 'desc' }
                : query.sort === 'newest'
                    ? { createdAt: 'desc' }
                    : { title: 'asc' };
        const [items, total] = await Promise.all([
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
        return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) };
    }
    async bySlug(slug) {
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
        if (!tour)
            throw new app_exception_1.AppException('TOUR_NOT_FOUND', 'Тур не найден', 404);
        return tour;
    }
    async create(dto) {
        const slug = await (0, slug_1.uniqueSlug)(dto.title, async (s) => !!(await this.db.tour.findFirst({ where: { slug: s, deletedAt: null }, select: { id: true } })));
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
    async update(id, dto) {
        await this.getOr404(id);
        const data = {};
        if (dto.title !== undefined)
            data.title = dto.title;
        if (dto.shortDescription !== undefined)
            data.shortDescription = dto.shortDescription;
        if (dto.description !== undefined)
            data.description = dto.description;
        if (dto.destinationId !== undefined)
            data.destination = { connect: { id: dto.destinationId } };
        if (dto.durationDays !== undefined)
            data.durationDays = dto.durationDays;
        if (dto.durationNights !== undefined)
            data.durationNights = dto.durationNights;
        if (dto.basePrice !== undefined)
            data.basePrice = dto.basePrice;
        if (dto.currency !== undefined)
            data.currency = dto.currency;
        if (dto.status !== undefined)
            data.status = dto.status;
        if (dto.adultPrice !== undefined)
            data.adultPrice = dto.adultPrice;
        if (dto.child10to14Price !== undefined)
            data.child10to14Price = dto.child10to14Price;
        if (dto.childUnder10Price !== undefined)
            data.childUnder10Price = dto.childUnder10Price;
        if (dto.metaTitle !== undefined)
            data.metaTitle = dto.metaTitle;
        if (dto.metaDescription !== undefined)
            data.metaDescription = dto.metaDescription;
        if (dto.includedText !== undefined)
            data.includedText = dto.includedText;
        if (dto.notIncludedText !== undefined)
            data.notIncludedText = dto.notIncludedText;
        return this.db.tour.update({ where: { id }, data });
    }
    /** Архивирование = soft delete (ТЗ §8 deletedAt). Физическое удаление не предоставляем. */
    async archive(id) {
        await this.getOr404(id);
        return this.db.tour.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
    }
    async getOr404(id) {
        const tour = await this.db.tour.findFirst({ where: { id, deletedAt: null } });
        if (!tour)
            throw new app_exception_1.AppException('TOUR_NOT_FOUND', 'Тур не найден', 404);
        return tour;
    }
};
exports.ToursService = ToursService;
exports.ToursService = ToursService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ToursService);
//# sourceMappingURL=tours.service.js.map