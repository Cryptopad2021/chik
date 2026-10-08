"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/all-exceptions.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bufferLogs: false });
    const logger = new common_1.Logger("Bootstrap");
    app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
    app.use((0, cookie_parser_1.default)());
    app.enableCors({
        origin: process.env.CORS_ORIGINS?.split(",") ?? true,
        credentials: true,
    });
    // Rate limit (ТЗ §39): общий и строгий для auth
    app.use("/api", (0, express_rate_limit_1.default)({
        windowMs: 60_000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
    }));
    app.use("/api/auth", (0, express_rate_limit_1.default)({
        windowMs: 15 * 60_000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Слишком много попыток, попробуйте позже",
            },
        },
    }));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true, // отбрасываем неизвестные поля (в т.ч. totalAmount из клиентской формы)
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
    }));
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle("ЧиркейТур API")
        .setDescription("REST API туристической платформы: туры, выезды, бронирования, CRM, отзывы")
        .setVersion("0.1.0")
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup("api/docs", app, document);
    const port = Number(process.env.PORT ?? 3001);
    await app.listen(port);
    logger.log(`API запущен на :${port} (Swagger: /api/docs)`);
}
bootstrap().catch((e) => {
    new common_1.Logger("Bootstrap").error(String(e));
    process.exit(1);
});
//# sourceMappingURL=main.js.map