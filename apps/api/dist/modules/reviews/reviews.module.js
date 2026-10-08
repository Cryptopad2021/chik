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
exports.ReviewsModule = exports.ReviewsController = exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_2 = require("@nestjs/swagger");
const prisma_service_1 = require("../../prisma/prisma.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const constants_1 = require("../../common/constants");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const audit_service_1 = require("../audit/audit.service");
class CreateReviewDto {
    tourId;
    rating;
    text;
    authorName;
    contact; // телефон/email для модерации — не публикуется
}
__decorate([
    (0, swagger_2.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "tourId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], CreateReviewDto.prototype, "rating", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "authorName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "contact", void 0);
let ReviewsService = class ReviewsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    get db() { return this.prisma; }
    async publicList(tourId) {
        if (!this.prisma.isHealthy())
            return [];
        return this.db.review.findMany({
            where: { status: 'APPROVED', ...(tourId ? { tourId } : {}) },
            orderBy: { createdAt: 'desc' },
            include: { tour: { select: { title: true, slug: true } }, customer: { select: { firstName: true, lastName: true } } },
        });
    }
    async adminList(status) {
        if (!this.prisma.isHealthy())
            return [];
        return this.db.review.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
            include: { tour: { select: { title: true } }, moderations: { orderBy: { createdAt: 'desc' } } },
        });
    }
    async create(dto) {
        const tour = await this.db.tour.findFirst({ where: { id: dto.tourId, deletedAt: null } });
        if (!tour)
            throw new common_1.NotFoundException({ code: 'TOUR_NOT_FOUND', message: 'Тур не найден' });
        // Анти-спам: не более одного PENDING-отзыва с того же имени на тур в сутки
        const since = new Date(Date.now() - 86400000);
        const recent = await this.db.review.findFirst({ where: { tourId: dto.tourId, authorName: dto.authorName, createdAt: { gte: since } } });
        if (recent)
            throw new common_1.BadRequestException({ code: 'REVIEW_TOO_FREQUENT', message: 'Вы уже оставляли отзыв недавно. Попробуйте позже.' });
        return this.db.review.create({
            data: {
                tourId: dto.tourId,
                rating: dto.rating,
                text: dto.text,
                authorName: dto.authorName,
                status: 'PENDING',
            },
            select: { id: true, status: true, createdAt: true },
        });
    }
    async moderate(id, status, userId, note) {
        const r = await this.db.review.findUnique({ where: { id } });
        if (!r)
            throw new common_1.NotFoundException({ code: 'REVIEW_NOT_FOUND', message: 'Отзыв не найден' });
        const updated = await this.db.review.update({ where: { id }, data: { status } });
        await this.db.reviewModeration.create({ data: { reviewId: id, action: status, userId, note: note ?? null } });
        return updated;
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReviewsService);
let ReviewsController = class ReviewsController {
    svc;
    audit;
    constructor(svc, audit) {
        this.svc = svc;
        this.audit = audit;
    }
    async list(tourId) { return { success: true, data: await this.svc.publicList(tourId) }; }
    async create(dto) { return { success: true, data: await this.svc.create(dto) }; }
    async adminList(status) {
        const valid = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? status : undefined;
        if (status && !valid)
            throw new common_1.BadRequestException({ code: 'INVALID_STATUS', message: 'Некорректный статус отзыва' });
        return { success: true, data: await this.svc.adminList(valid) };
    }
    async moderate(id, status, note, user) {
        if (!['APPROVED', 'REJECTED'].includes(status))
            throw new common_1.BadRequestException({ code: 'VALIDATION_FAILED', message: 'Статус должен быть APPROVED или REJECTED' });
        const r = await this.svc.moderate(id, status, user.id, note);
        await this.audit.log({ userId: user.id, action: 'REVIEW_MODERATED', entity: 'Review', entityId: id, metadata: { status } });
        return { success: true, data: r };
    }
};
exports.ReviewsController = ReviewsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Публикуются только APPROVED отзывы (ТЗ §22)' }),
    __param(0, (0, common_1.Query)('tourId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Оставить отзыв (падает в PENDING до модерации)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateReviewDto]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('admin/all'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.REVIEW_READ),
    (0, swagger_1.ApiOperation)({ summary: 'Все отзывы для модерации (review:read)' }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "adminList", null);
__decorate([
    (0, common_1.Patch)(':id/moderate'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermissions)(constants_1.PERMISSIONS.REVIEW_MODERATE),
    (0, swagger_1.ApiOperation)({ summary: 'Модерация: APPROVED/REJECTED (review:moderate)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __param(2, (0, common_1.Body)('note')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "moderate", null);
exports.ReviewsController = ReviewsController = __decorate([
    (0, swagger_1.ApiTags)('reviews'),
    (0, common_1.Controller)('api/reviews'),
    __metadata("design:paramtypes", [ReviewsService, audit_service_1.AuditService])
], ReviewsController);
let ReviewsModule = class ReviewsModule {
};
exports.ReviewsModule = ReviewsModule;
exports.ReviewsModule = ReviewsModule = __decorate([
    (0, common_1.Module)({ controllers: [ReviewsController], providers: [ReviewsService], exports: [ReviewsService] })
], ReviewsModule);
//# sourceMappingURL=reviews.module.js.map