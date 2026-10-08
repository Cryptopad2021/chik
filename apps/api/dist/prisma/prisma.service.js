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
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
/**
 * PrismaService (ТЗ Phase 3.1): singleton-клиент + graceful shutdown.
 * Все запросы идут через ORM — защита от SQL injection (§39).
 */
let PrismaService = PrismaService_1 = class PrismaService extends client_1.PrismaClient {
    logger = new common_1.Logger(PrismaService_1.name);
    constructor() {
        super({
            log: process.env.NODE_ENV === "development"
                ? [{ emit: "event", level: "query" }, "warn", "error"]
                : ["warn", "error"],
        });
    }
    async onModuleInit() {
        try {
            await this.$connect();
            this.healthy = true;
            this.startHealthProbe();
            this.logger.log("PostgreSQL connected");
        }
        catch (err) {
            // В dev-среде без БД приложение должно стартовать (health всё равно отвечает),
            // но ошибку логируем честно.
            this.logger.error(`PostgreSQL connect failed: ${err.message}`);
        }
        if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.$on("query", (e) => {
                this.logger.debug(`query ${e.time}ms ${e.query}`);
            });
        }
    }
    healthy = false;
    /** Синхронная проверка статуса соединения — для guard-ов в сервисах. */
    isHealthy() {
        return this.healthy;
    }
    /** Проверяет реальную доступность БД (для /health) и кэширует результат. */
    async checkHealth() {
        try {
            await this.$queryRaw `SELECT 1`;
            this.healthy = true;
        }
        catch {
            this.healthy = false;
        }
        return this.healthy;
    }
    /** Фоновая-health-периодика: держим флаг актуальным после стартовых reconnect. */
    startHealthProbe(intervalMs = 30_000) {
        const t = setInterval(() => void this.checkHealth(), intervalMs);
        t.unref();
        return t;
    }
    async enableShutdownHooks(app) {
        process.on("beforeExit", async () => {
            await app.close();
        });
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map