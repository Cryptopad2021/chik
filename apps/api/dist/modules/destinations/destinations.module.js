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
exports.DestinationsModule = exports.DestinationsController = exports.DestinationsService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../../prisma/prisma.service");
const slug_1 = require("../../common/slug");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const constants_1 = require("../../common/constants");
class UpsertDestinationDto {
    name;
    description;
    isActive;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpsertDestinationDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], UpsertDestinationDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpsertDestinationDto.prototype, "isActive", void 0);
let DestinationsService = class DestinationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    get db() {
        return this.prisma;
    }
    async list(includeHidden = false) {
        if (!this.prisma.isHealthy())
            return [];
        return this.db.destination.findMany({
            where: includeHidden ? undefined : { isActive: true },
            orderBy: { name: "asc" },
            include: { _count: { select: { tours: true } } },
        });
    }
    async bySlug(slug) {
        const d = await this.db.destination.findFirst({
            where: { slug },
            include: {
                tours: {
                    where: { status: "PUBLISHED", deletedAt: null },
                    include: { images: { where: { isCover: true }, take: 1 } },
                },
            },
        });
        if (!d)
            throw new common_1.NotFoundException({
                code: "DESTINATION_NOT_FOUND",
                message: "Направление не найдено",
            });
        return d;
    }
    async create(dto) {
        const base = (0, slug_1.slugify)(dto.name);
        const slug = await (0, slug_1.ensureUniqueSlug)(base, async (s) => !!(await this.db.destination.findFirst({
            where: { slug: s },
            select: { id: true },
        })));
        return this.db.destination.create({ data: { ...dto, slug } });
    }
    async update(id, dto) {
        return this.db.destination.update({ where: { id }, data: dto });
    }
};
exports.DestinationsService = DestinationsService;
exports.DestinationsService = DestinationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DestinationsService);
let DestinationsController = class DestinationsController {
    svc;
    jwt;
    constructor(svc, jwt) {
        this.svc = svc;
        this.jwt = jwt;
    }
    async list() {
        return { success: true, data: await this.svc.list(false) };
    }
    async bySlug(slug) {
        return { success: true, data: await this.svc.bySlug(slug) };
    }
    async create(dto) {
        return { success: true, data: await this.svc.create(dto) };
    }
    async update(id, dto) {
        return { success: true, data: await this.svc.update(id, dto) };
    }
};
exports.DestinationsController = DestinationsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "Список направлений" }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DestinationsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(":slug"),
    (0, swagger_1.ApiOperation)({ summary: "Направление с опубликованными турами" }),
    __param(0, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DestinationsController.prototype, "bySlug", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.TOUR_WRITE),
    (0, swagger_1.ApiOperation)({ summary: "Создать направление (tour:write)" }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpsertDestinationDto]),
    __metadata("design:returntype", Promise)
], DestinationsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.TOUR_WRITE),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpsertDestinationDto]),
    __metadata("design:returntype", Promise)
], DestinationsController.prototype, "update", null);
exports.DestinationsController = DestinationsController = __decorate([
    (0, swagger_1.ApiTags)("destinations"),
    (0, common_1.Controller)("api/destinations"),
    __metadata("design:paramtypes", [DestinationsService,
        jwt_auth_guard_1.JwtAuthGuard])
], DestinationsController);
let DestinationsModule = class DestinationsModule {
};
exports.DestinationsModule = DestinationsModule;
exports.DestinationsModule = DestinationsModule = __decorate([
    (0, common_1.Module)({
        controllers: [DestinationsController],
        providers: [DestinationsService],
        exports: [DestinationsService],
    })
], DestinationsModule);
//# sourceMappingURL=destinations.module.js.map