import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface AuditEntry {
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/** Audit Log (ТЗ §38). Ошибки записи не ломают бизнес-операцию. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    if (!this.prisma.isHealthy()) return;
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          metadata: (entry.metadata ?? {}) as object,
        },
      });
    } catch (e) {
      this.logger.error(`Audit write failed: ${(e as Error).message}`);
    }
  }

  async list(limit = 100) {
    if (!this.prisma.isHealthy()) return [];
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    });
  }
}
