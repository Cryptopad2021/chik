import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ApiErrorBody, ErrorCode } from "@chirkey/types";
import type { Response, Request } from "express";
import { AppException } from "./app-exception";

/**
 * Единый обработчик ошибок (ТЗ §45):
 * { success: false, error: { code, message, details? } }
 * Stack trace пользователю НЕ отдаём — только логируем на сервере (§45/§46).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = "INTERNAL_ERROR";
    let message = "Внутренняя ошибка сервера. Попробуйте позже.";
    let details: unknown;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === "string"
          ? res
          : (((res as { message?: string | string[] }).message ??
              exception.message) as string);
      if (Array.isArray(message)) message = message.join("; ");
      code =
        status === HttpStatus.BAD_REQUEST
          ? "VALIDATION_FAILED"
          : status === HttpStatus.UNAUTHORIZED
            ? "UNAUTHORIZED"
            : status === HttpStatus.FORBIDDEN
              ? "FORBIDDEN"
              : status === HttpStatus.NOT_FOUND
                ? "NOT_FOUND"
                : status === HttpStatus.CONFLICT
                  ? "CONFLICT"
                  : status === HttpStatus.TOO_MANY_REQUESTS
                    ? "RATE_LIMITED"
                    : "INTERNAL_ERROR";
      if (status >= 500)
        message = "Внутренняя ошибка сервера. Попробуйте позже.";
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Уникальные ограничения → понятные коды, без утечки SQL (§39)
      if (exception.code === "P2002") {
        status = HttpStatus.CONFLICT;
        code = "CONFLICT";
        message = "Значение уже используется (дубликат).";
        details = { fields: exception.meta?.target };
      } else if (exception.code === "P2025") {
        status = HttpStatus.NOT_FOUND;
        code = "NOT_FOUND";
        message = "Запись не найдена.";
      } else {
        status = HttpStatus.BAD_REQUEST;
        code = "VALIDATION_FAILED";
        message = "Ошибка запроса к данным.";
      }
    } else if (exception instanceof Error) {
      message = "Внутренняя ошибка сервера. Попробуйте позже.";
    }

    // Структурированный лог (§46): без secrets, без тела запроса с PII-полями паролей
    this.logger.error(
      JSON.stringify({
        level: "error",
        service: "api",
        requestId: request.headers["x-request-id"] ?? "-",
        method: request.method,
        path: request.url,
        status,
        code,
        message:
          exception instanceof Error ? exception.message : String(exception),
      }),
      exception instanceof Error && status >= 500 ? exception.stack : undefined,
    );

    const body: ApiErrorBody = {
      success: false,
      error: { code, message, ...(details !== undefined ? { details } : {}) },
    };
    void response.status(status).json(body);
  }
}
