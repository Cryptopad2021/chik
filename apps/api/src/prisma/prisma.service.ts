import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * PrismaService (ТЗ Phase 3.1): singleton-клиент + graceful shutdown.
 * Все запросы идут через ORM — защита от SQL injection (§39).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === "development"
          ? [{ emit: "event", level: "query" }, "warn", "error"]
          : ["warn", "error"],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.healthy = true;
      this.startHealthProbe();
      this.logger.log("PostgreSQL connected");
    } catch (err) {
      // В dev-среде без БД приложение должно стартовать (health всё равно отвечает),
      // но ошибку логируем честно.
      this.logger.error(`PostgreSQL connect failed: ${(err as Error).message}`);
    }
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).$on("query", (e: any) => {
        this.logger.debug(`query ${e.time}ms ${e.query}`);
      });
    }
  }

  private healthy = false;

  /** Синхронная проверка статуса соединения — для guard-ов в сервисах. */
  isHealthy(): boolean {
    return this.healthy;
  }

  /** Проверяет реальную доступность БД (для /health) и кэширует результат. */
  async checkHealth(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.healthy = true;
    } catch {
      this.healthy = false;
    }
    return this.healthy;
  }

  /** Фоновая-health-периодика: держим флаг актуальным после стартовых reconnect. */
  startHealthProbe(intervalMs = 30_000): NodeJS.Timeout {
    const t = setInterval(() => void this.checkHealth(), intervalMs);
    t.unref();
    return t;
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    process.on("beforeExit", async () => {
      await app.close();
    });
  }
}
