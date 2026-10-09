import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import express from "express";
import fsSync from "fs";
import path from "path";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const logger = new Logger("Bootstrap");

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(",") ?? true,
    credentials: true,
  });
  // Rate limit (ТЗ §39): общий и строгий для auth
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(
    "/api/auth",
    rateLimit({
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
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // отбрасываем неизвестные поля (в т.ч. totalAmount из клиентской формы)
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Статическая раздача загруженных медиа (local-бэкенд StorageService, ТЗ §41).
  // express.static нормализует путь и не отдаёт файлы за пределами корня — защита от path traversal.
  const mediaRoot = process.env.MEDIA_ROOT;
  if (mediaRoot) {
    const absRoot = path.resolve(mediaRoot);
    fsSync.mkdirSync(absRoot, { recursive: true });
    const http = app.getHttpAdapter().getInstance();
    http.use(
      "/media",
      express.static(absRoot, {
        index: false,
        dotfiles: "ignore",
        maxAge: "30d",
        immutable: true,
      }),
    );
    new Logger("Bootstrap").log(`Медиа раздаются из ${absRoot} по /media/*`);
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle("ЧиркейТур API")
    .setDescription(
      "REST API туристической платформы: туры, выезды, бронирования, CRM, отзывы",
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log(`API запущен на :${port} (Swagger: /api/docs)`);
}
bootstrap().catch((e) => {
  new Logger("Bootstrap").error(String(e));
  process.exit(1);
});
