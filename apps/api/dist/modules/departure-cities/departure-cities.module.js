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
exports.DepartureCitiesModule = exports.DepartureCitiesController = exports.DepartureCitiesService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../../prisma/prisma.service");
const slug_1 = require("../../common/slug");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const constants_1 = require("../../common/constants");
class UpsertCityDto {
    name;
    address;
    lat;
    lng;
    meetingInstructions;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpsertCityDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], UpsertCityDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpsertCityDto.prototype, "lat", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpsertCityDto.prototype, "lng", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], UpsertCityDto.prototype, "meetingInstructions", void 0);
let DepartureCitiesService = class DepartureCitiesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(activeOnly = true) {
        if (!this.prisma.isHealthy())
            return [];
        return this.prisma.departureCity.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: { sortOrder: "asc" },
        });
    }
    async create(dto) {
        const base = (0, slug_1.slugify)(dto.name);
        const slug = await (0, slug_1.ensureUniqueSlug)(base, async (s) => !!(await this.prisma.departureCity.findFirst({
            where: { slug: s },
            select: { id: true },
        })));
        return this.prisma.departureCity.create({
            data: {
                ...dto,
                slug,
                address: dto.address ?? undefined,
                meetingInstructions: dto.meetingInstructions ?? undefined,
                coordinates: dto.lat != null && dto.lng != null ? { lat: dto.lat, lng: dto.lng } : undefined,
            },
        });
    }
    async update(id, dto) {
        const c = await this.prisma.departureCity.findUnique({ where: { id } });
        if (!c)
            throw new common_1.NotFoundException({
                code: "CITY_NOT_FOUND",
                message: "Город не найден",
            });
        return this.prisma.departureCity.update({
            where: { id },
            data: {
                name: dto.name,
                address: dto.address ?? undefined,
                meetingInstructions: dto.meetingInstructions ?? undefined,
                coordinates: dto.lat != null && dto.lng != null
                    ? { lat: dto.lat, lng: dto.lng }
                    : undefined,
            },
        });
    }
};
exports.DepartureCitiesService = DepartureCitiesService;
exports.DepartureCitiesService = DepartureCitiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DepartureCitiesService);
let DepartureCitiesController = class DepartureCitiesController {
    svc;
    jwt;
    constructor(svc, jwt) {
        this.svc = svc;
        this.jwt = jwt;
    }
    async list() {
        return { success: true, data: await this.svc.list(true) };
    }
    async create(dto) {
        return { success: true, data: await this.svc.create(dto) };
    }
    async update(id, dto) {
        return { success: true, data: await this.svc.update(id, dto) };
    }
};
exports.DepartureCitiesController = DepartureCitiesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "Города отправления" }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DepartureCitiesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.DEPARTURE_WRITE),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpsertCityDto]),
    __metadata("design:returntype", Promise)
], DepartureCitiesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.DEPARTURE_WRITE),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpsertCityDto]),
    __metadata("design:returntype", Promise)
], DepartureCitiesController.prototype, "update", null);
exports.DepartureCitiesController = DepartureCitiesController = __decorate([
    (0, swagger_1.ApiTags)("departure-cities"),
    (0, common_1.Controller)("api/departure-cities"),
    __metadata("design:paramtypes", [DepartureCitiesService,
        jwt_auth_guard_1.JwtAuthGuard])
], DepartureCitiesController);
let DepartureCitiesModule = class DepartureCitiesModule {
};
exports.DepartureCitiesModule = DepartureCitiesModule;
exports.DepartureCitiesModule = DepartureCitiesModule = __decorate([
    (0, common_1.Module)({
        controllers: [DepartureCitiesController],
        providers: [DepartureCitiesService],
        exports: [DepartureCitiesService],
    })
], DepartureCitiesModule);
//# sourceMappingURL=departure-cities.module.js.map