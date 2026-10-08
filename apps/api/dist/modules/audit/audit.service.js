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
var AuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
/** Audit Log (ТЗ §38). Ошибки записи не ломают бизнес-операцию. */
let AuditService = AuditService_1 = class AuditService {
    prisma;
    logger = new common_1.Logger(AuditService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async log(entry) {
        if (!this.prisma.isHealthy())
            return;
        try {
            await this.prisma.auditLog.create({
                data: {
                    userId: entry.userId ?? null,
                    action: entry.action,
                    entity: entry.entity,
                    entityId: entry.entityId,
                    metadata: (entry.metadata ?? {}),
                },
            });
        }
        catch (e) {
            this.logger.error(`Audit write failed: ${e.message}`);
        }
    }
    async list(limit = 100) {
        if (!this.prisma.isHealthy())
            return [];
        return this.prisma.auditLog.findMany({
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
            },
        });
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditService);
//# sourceMappingURL=audit.service.js.map