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
exports.ToursController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const tours_service_1 = require("./tours.service");
const dto_1 = require("./dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const constants_1 = require("../../common/constants");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const audit_service_1 = require("../audit/audit.service");
let ToursController = class ToursController {
    tours;
    audit;
    constructor(tours, audit) {
        this.tours = tours;
        this.audit = audit;
    }
    async list(q) {
        return { success: true, data: await this.tours.list(q) };
    }
    async bySlug(slug) {
        return { success: true, data: await this.tours.bySlug(slug) };
    }
    async create(dto, user) {
        const tour = await this.tours.create(dto);
        await this.audit.log({
            userId: user.id,
            action: "TOUR_CREATED",
            entity: "Tour",
            entityId: tour.id,
            metadata: { title: tour.title },
        });
        return { success: true, data: tour };
    }
    async update(id, dto, user) {
        const tour = await this.tours.update(id, dto);
        await this.audit.log({
            userId: user.id,
            action: "TOUR_UPDATED",
            entity: "Tour",
            entityId: id,
            metadata: { fields: Object.keys(dto) },
        });
        return { success: true, data: tour };
    }
    async archive(id, user) {
        const tour = await this.tours.archive(id);
        await this.audit.log({
            userId: user.id,
            action: "TOUR_ARCHIVED",
            entity: "Tour",
            entityId: id,
        });
        return { success: true, data: { id: tour.id, archived: true } };
    }
};
exports.ToursController = ToursController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: "Каталог туров (публичный; фильтры: destination, city, dates, price, duration, sort)",
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ListToursQuery]),
    __metadata("design:returntype", Promise)
], ToursController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(":slug"),
    (0, swagger_1.ApiOperation)({
        summary: "Тур по slug с программой, галереей, выездами и отзывами",
    }),
    __param(0, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ToursController.prototype, "bySlug", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.TOUR_WRITE),
    (0, swagger_1.ApiOperation)({ summary: "Создать тур (tour:write)" }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateTourDto, Object]),
    __metadata("design:returntype", Promise)
], ToursController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.TOUR_WRITE),
    (0, swagger_1.ApiOperation)({ summary: "Обновить тур (tour:write)" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateTourDto, Object]),
    __metadata("design:returntype", Promise)
], ToursController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(":id"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.TOUR_WRITE),
    (0, swagger_1.ApiOperation)({ summary: "Архивировать тур — soft delete (tour:write)" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ToursController.prototype, "archive", null);
exports.ToursController = ToursController = __decorate([
    (0, swagger_1.ApiTags)("tours"),
    (0, common_1.Controller)("api/tours"),
    __metadata("design:paramtypes", [tours_service_1.ToursService,
        audit_service_1.AuditService])
], ToursController);
//# sourceMappingURL=tours.controller.js.map