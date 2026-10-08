/**
 * Валидация окружения (ТЗ Phase 3.2, §39): секреты только из env;
 * приложение не стартует с отсутствующими обязательными переменными в production.
 */
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_PREFIX: z.string().default("api"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3002"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET минимум 16 символов"),
  JWT_ACCESS_TTL: z.string().default("900"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, "JWT_REFRESH_SECRET минимум 16 символов"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  WEB_URL: z.string().url().optional(),
  // Telegram — опциональны на этом этапе (реальная интеграция — Phase 10)
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHANNEL_ID: z.string().optional(),
  // S3 — опциональны (Phase 5 media)
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Не печатаем значения секретов — только имена полей (§39/§46).
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`,
    );
    throw new Error(
      `Invalid environment configuration:\n  ${issues.join("\n  ")}`,
    );
  }
  cached = parsed.data;
  return cached;
}

export function getEnv(): Env {
  if (!cached) return loadEnv();
  return cached;
}

/** true, если process.env проходит схему (без бросания). */
export function envIsValid(source: NodeJS.ProcessEnv = process.env): boolean {
  try {
    loadEnv(source);
    return true;
  } catch {
    return false;
  }
}
