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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeparturesModule = exports.DeparturesController = exports.DeparturesService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const prisma_service_1 = require("../../prisma/prisma.service");
const app_exception_1 = require("../../common/app-exception");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const constants_1 = require("../../common/constants");
const audit_service_1 = require("../audit/audit.service");
const dto_1 = require("./dto");
/** Статусы, при которых продажи закрыты и менять состав нельзя. */
const CLOSED_STATUSES = ['CANCELLED', 'COMPLETED'];
let DeparturesService = class DeparturesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    get db() {
        if (!this.prisma.isHealthy())
            throw app_exception_1.AppException.databaseUnavailable();
        return this.prisma;
    }
    /** availableSeats — вычисляемое поле (ТЗ §12). */
    decorate(d) {
        const availableSeats = Math.max(d.totalSeats - d.bookedSeats, 0);
        return {
            ...d,
            price: Number(d.price),
            availableSeats,
            fillPercent: d.totalSeats > 0 ? Math.round((d.bookedSeats / d.totalSeats) * 100) : 0,
        };
    }
    async list(query) {
        if (!this.prisma.isHealthy())
            return [];
        const where = {};
        if (query.tourId)
            where.tourId = query.tourId;
        if (query.status)
            where.status = query.status;
        if (query.dateFrom || query.dateTo) {
            where.startDate = {
                ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            };
        }
        if (query.upcomingOnly === 'true') {
            where.startDate = { ...where.startDate, gte: new Date() };
            where.status = where.status ?? { in: ['OPEN', 'ALMOST_FULL'] };
        }
        if (query.citySlug) {
            where.cities = { some: { departureCity: { slug: query.citySlug, isActive: true } } };
        }
        const items = await this.db.departure.findMany({
            where,
            orderBy: { startDate: 'asc' },
            include: {
                tour: { select: { id: true, slug: true, title: true } },
                cities: { include: { departureCity: { select: { id: true, name: true, slug: true } } } },
            },
        });
        return items.map((d) => this.decorate(d));
    }
    async byId(id) {
        const d = await this.db.departure.findUnique({
            where: { id },
            include: {
                tour: { select: { id: true, slug: true, title: true, adultPrice: true, child10to14Price: true, childUnder10Price: true } },
                cities: { include: { departureCity: true } },
            },
        });
        if (!d)
            throw new app_exception_1.AppException('DEPARTURE_NOT_FOUND', 'Выезд не найден', 404);
        return this.decorate(d);
    }
    validateDates(startDate, endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
            throw new common_1.BadRequestException({ code: 'INVALID_DATES', message: 'Некорректные даты' });
        }
        if (e < s) {
            throw new common_1.BadRequestException({
                code: 'END_BEFORE_START',
                message: 'Дата окончания раньше даты начала',
            });
        }
        return { s, e };
    }
    async create(dto, userId) {
        const tour = await this.db.tour.findFirst({ where: { id: dto.tourId, deletedAt: null } });
        if (!tour)
            throw new app_exception_1.AppException('TOUR_NOT_FOUND', 'Тур не найден', 404);
        const { s, e } = this.validateDates(dto.startDate, dto.endDate);
        await this.assertCitiesExist(dto.cities?.map((c) => c.departureCityId) ?? []);
        const created = await this.db.departure.create({
            data: {
                tourId: dto.tourId,
                startDate: s,
                endDate: e,
                totalSeats: dto.totalSeats,
                price: dto.price,
                status: (dto.status ?? 'OPEN'),
                notes: dto.notes,
                cities: dto.cities?.length
                    ? { create: dto.cities.map((c) => ({ departureCityId: c.departureCityId, price: c.price, notes: c.notes })) }
                    : undefined,
            },
            include: { cities: { include: { departureCity: true } } },
        });
        await this.audit.log({ userId, action: 'DEPARTURE_CREATED', entity: 'Departure', entityId: created.id, metadata: { tourId: dto.tourId, startDate: dto.startDate } });
        return this.decorate(created);
    }
    async update(id, dto, userId) {
        const existing = await this.db.departure.findUnique({ where: { id } });
        if (!existing)
            throw new app_exception_1.AppException('DEPARTURE_NOT_FOUND', 'Выезд не найден', 404);
        if (CLOSED_STATUSES.includes(existing.status) && (dto.cities || dto.startDate)) {
            throw new common_1.ConflictException({
                code: 'DEPARTURE_CLOSED',
                message: 'Нельзя редактировать даты/города закрытого выезда',
            });
        }
        const data = {};
        if (dto.startDate || dto.endDate) {
            const { s, e } = this.validateDates(dto.startDate ?? existing.startDate.toISOString(), dto.endDate ?? existing.endDate.toISOString());
            // Нельзя увести выезд в прошлое, если есть активные брони
            const activeBookings = await this.db.booking.count({
                where: { departureId: id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
            });
            if (activeBookings > 0 && s.getTime() < Date.now()) {
                throw new common_1.ConflictException({
                    code: 'DEPARTURE_HAS_BOOKINGS',
                    message: 'У выезда есть активные брони — нельзя переносить в прошлое',
                });
            }
            data.startDate = s;
            data.endDate = e;
        }
        if (dto.cities) {
            await this.assertCitiesExist(dto.cities.map((c) => c.departureCityId));
            await this.db.departureCityOnDeparture.deleteMany({ where: { departureId: id } });
            data.cities = { create: dto.cities.map((c) => ({ departureCityId: c.departureCityId, price: c.price, notes: c.notes })) };
        }
        if (dto.notes !== undefined)
            data.notes = dto.notes;
        if (dto.price !== undefined)
            data.price = dto.price;
        if (dto.totalSeats !== undefined) {
            // Уменьшать ниже забронированного нельзя — защита от рассогласования мест (§54)
            if (dto.totalSeats < existing.bookedSeats) {
                throw new common_1.ConflictException({
                    code: 'SEATS_BELOW_BOOKED',
                    message: `Нельзя уменьшить количество мест ниже уже забронированных (${existing.bookedSeats})`,
                });
            }
            data.totalSeats = dto.totalSeats;
        }
        if (dto.status)
            data.status = dto.status;
        const updated = await this.db.departure.update({
            where: { id },
            data,
            include: { cities: { include: { departureCity: true } } },
        });
        await this.audit.log({ userId, action: 'DEPARTURE_UPDATED', entity: 'Departure', entityId: id, metadata: dto });
        return this.decorate(updated);
    }
    /** Закрытие продаж (§21): OPEN → CANCELLED без потерь мест. */
    async closeSales(id, userId) {
        const d = await this.db.departure.findUnique({ where: { id } });
        if (!d)
            throw new app_exception_1.AppException('DEPARTURE_NOT_FOUND', 'Выезд не найден', 404);
        if (d.status === 'COMPLETED')
            throw new common_1.ConflictException('Завершённый выезд нельзя закрыть');
        const updated = await this.db.departure.update({ where: { id }, data: { status: 'CANCELLED' } });
        await this.audit.log({ userId, action: 'DEPARTURE_SALES_CLOSED', entity: 'Departure', entityId: id, metadata: { from: d.status } });
        return updated;
    }
    async assertCitiesExist(ids) {
        if (!ids.length)
            return;
        const found = await this.db.departureCity.count({ where: { id: { in: ids }, isActive: true } });
        if (found !== new Set(ids).size) {
            throw new common_1.BadRequestException({ code: 'CITY_NOT_AVAILABLE', message: 'Один или несколько городов недоступны' });
        }
    }
};
exports.DeparturesService = DeparturesService;
exports.DeparturesService = DeparturesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], DeparturesService);
let DeparturesController = class DeparturesController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    async list(q) {
        return { success: true, data: await this.svc.list(q) };
    }
    async one(id) {
        return { success: true, data: await this.svc.byId(id) };
    }
    async create(dto, userId) {
        return { success: true, data: await this.svc.create(dto, userId) };
    }
    async update(id, dto, userId) {
        return { success: true, data: await this.svc.update(id, dto, userId) };
    }
    async close(id, userId) {
        return { success: true, data: await this.svc.closeSales(id, userId) };
    }
};
exports.DeparturesController = DeparturesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Расписание выездов (публичное)' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ListDeparturesQuery]),
    __metadata("design:returntype", Promise)
], DeparturesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Выезд по id' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DeparturesController.prototype, "one", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.DEPARTURE_WRITE),
    (0, swagger_1.ApiOperation)({ summary: 'Создать выезд' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateDepartureDto, String]),
    __metadata("design:returntype", Promise)
], DeparturesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.DEPARTURE_WRITE),
    (0, swagger_1.ApiOperation)({ summary: 'Изменить выезд' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateDepartureDto, String]),
    __metadata("design:returntype", Promise)
], DeparturesController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/close-sales'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.DEPARTURE_WRITE),
    (0, swagger_1.ApiOperation)({ summary: 'Закрыть продажи выезда' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DeparturesController.prototype, "close", null);
exports.DeparturesController = DeparturesController = __decorate([
    (0, swagger_1.ApiTags)('departures'),
    (0, common_1.Controller)('api/departures'),
    __metadata("design:paramtypes", [DeparturesService])
], DeparturesController);
let DeparturesModule = class DeparturesModule {
};
exports.DeparturesModule = DeparturesModule;
exports.DeparturesModule = DeparturesModule = __decorate([
    (0, common_1.Module)({
        controllers: [DeparturesController],
        providers: [DeparturesService],
        exports: [DeparturesService],
    })
], DeparturesModule);
//# sourceMappingURL=departures.module.js.map