"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnv = loadEnv;
exports.getEnv = getEnv;
exports.envIsValid = envIsValid;
/**
 * Валидация окружения (ТЗ Phase 3.2, §39): секреты только из env;
 * приложение не стартует с отсутствующими обязательными переменными в production.
 */
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z
        .enum(["development", "production", "test"])
        .default("development"),
    DATABASE_URL: zod_1.z.string().min(1),
    API_PORT: zod_1.z.coerce.number().int().positive().default(3001),
    API_PREFIX: zod_1.z.string().default("api"),
    CORS_ORIGINS: zod_1.z
        .string()
        .default("http://localhost:3000,http://localhost:3002"),
    JWT_SECRET: zod_1.z.string().min(16, "JWT_SECRET минимум 16 символов"),
    JWT_ACCESS_TTL: zod_1.z.string().default("900"),
    JWT_REFRESH_SECRET: zod_1.z
        .string()
        .min(16, "JWT_REFRESH_SECRET минимум 16 символов"),
    JWT_REFRESH_TTL_DAYS: zod_1.z.coerce.number().int().positive().default(30),
    WEB_URL: zod_1.z.string().url().optional(),
    // Telegram — опциональны на этом этапе (реальная интеграция — Phase 10)
    TELEGRAM_BOT_TOKEN: zod_1.z.string().optional(),
    TELEGRAM_CHANNEL_ID: zod_1.z.string().optional(),
    // S3 — опциональны (Phase 5 media)
    S3_ENDPOINT: zod_1.z.string().optional(),
    S3_REGION: zod_1.z.string().optional(),
    S3_ACCESS_KEY: zod_1.z.string().optional(),
    S3_SECRET_KEY: zod_1.z.string().optional(),
    S3_BUCKET: zod_1.z.string().optional(),
});
let cached;
function loadEnv(source = process.env) {
    const parsed = envSchema.safeParse(source);
    if (!parsed.success) {
        // Не печатаем значения секретов — только имена полей (§39/§46).
        const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
        throw new Error(`Invalid environment configuration:\n  ${issues.join("\n  ")}`);
    }
    cached = parsed.data;
    return cached;
}
function getEnv() {
    if (!cached)
        return loadEnv();
    return cached;
}
/** true, если process.env проходит схему (без бросания). */
function envIsValid(source = process.env) {
    try {
        loadEnv(source);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=env.js.map