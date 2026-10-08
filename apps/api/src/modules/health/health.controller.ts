import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller("api/health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @ApiOperation({ summary: "Проверка живости сервиса" })
  @ApiOkResponse({ description: "Сервис доступен" })
  @Get()
  async check() {
    const dbOk = await this.prisma.checkHealth();
    return {
      success: true as const,
      data: {
        status: dbOk ? "ok" : "degraded",
        service: "chirkey-api",
        db: dbOk ? "up" : "down",
        ts: new Date().toISOString(),
      },
    };
  }
}
