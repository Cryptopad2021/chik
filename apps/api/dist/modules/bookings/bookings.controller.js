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
exports.BookingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const bookings_service_1 = require("./bookings.service");
const dto_1 = require("./dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const constants_1 = require("../../common/constants");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const audit_service_1 = require("../audit/audit.service");
let BookingsController = class BookingsController {
    bookings;
    audit;
    constructor(bookings, audit) {
        this.bookings = bookings;
        this.audit = audit;
    }
    async create(dto) {
        const { booking, replayed } = await this.bookings.create(dto);
        return {
            success: true,
            data: {
                bookingNumber: booking.bookingNumber,
                id: booking.id,
                status: booking.status,
                totalAmount: booking.totalAmount,
                currency: booking.currency,
                replayed,
            },
        };
    }
    async byNumber(bookingNumber) {
        return {
            success: true,
            data: await this.bookings.byNumberPublic(bookingNumber),
        };
    }
    async list(status, tourId, search, page, perPage) {
        return {
            success: true,
            data: await this.bookings.list({
                status,
                tourId,
                search,
                page: Number(page) || undefined,
                perPage: Number(perPage) || undefined,
            }),
        };
    }
    async byId(id) {
        return { success: true, data: await this.bookings.byId(id) };
    }
    async changeStatus(id, dto, user) {
        const result = await this.bookings.changeStatus(id, dto.status, user.id, dto.note);
        await this.audit.log({
            userId: user.id,
            action: "BOOKING_STATUS_CHANGED",
            entity: "Booking",
            entityId: id,
            metadata: { from: result.previous, to: result.current },
        });
        return { success: true, data: result };
    }
    async assignManager(id, managerId, user) {
        const r = await this.bookings.assignManager(id, managerId);
        await this.audit.log({
            userId: user.id,
            action: "BOOKING_ASSIGNED",
            entity: "Booking",
            entityId: id,
            metadata: { managerId },
        });
        return { success: true, data: r };
    }
    async addComment(id, text, user) {
        return {
            success: true,
            data: await this.bookings.addComment(id, text, user.id),
        };
    }
};
exports.BookingsController = BookingsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: "Создать заявку (публичный; атомарное списание мест, защита от overselling)",
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateBookingDto]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)("by-number/:bookingNumber"),
    (0, swagger_1.ApiOperation)({
        summary: "Публичная страница подтверждения заявки по номеру",
    }),
    __param(0, (0, common_1.Param)("bookingNumber")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "byNumber", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.BOOKING_READ),
    (0, swagger_1.ApiOperation)({
        summary: "Список заявок (booking:read): поиск, фильтры статуса/тура, пагинация",
    }),
    __param(0, (0, common_1.Query)("status")),
    __param(1, (0, common_1.Query)("tourId")),
    __param(2, (0, common_1.Query)("search")),
    __param(3, (0, common_1.Query)("page")),
    __param(4, (0, common_1.Query)("perPage")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.BOOKING_READ),
    (0, swagger_1.ApiOperation)({ summary: "Заявка целиком (booking:read)" }),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "byId", null);
__decorate([
    (0, common_1.Patch)(":id/status"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.BOOKING_MANAGE),
    (0, swagger_1.ApiOperation)({
        summary: "Смена статуса (booking:manage) с machine-readable переходом и освобождением мест при отмене",
    }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.ChangeBookingStatusDto, Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "changeStatus", null);
__decorate([
    (0, common_1.Patch)(":id/manager"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.BOOKING_MANAGE),
    (0, swagger_1.ApiOperation)({ summary: "Назначить менеджера (booking:manage)" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)("managerId")),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "assignManager", null);
__decorate([
    (0, common_1.Patch)(":id/comment"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.BOOKING_READ),
    (0, swagger_1.ApiOperation)({ summary: "Добавить комментарий менеджера" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)("text")),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "addComment", null);
exports.BookingsController = BookingsController = __decorate([
    (0, swagger_1.ApiTags)("bookings"),
    (0, common_1.Controller)("api/bookings"),
    __metadata("design:paramtypes", [bookings_service_1.BookingsService,
        audit_service_1.AuditService])
], BookingsController);
//# sourceMappingURL=bookings.controller.js.map