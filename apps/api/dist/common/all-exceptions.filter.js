"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const app_exception_1 = require("./app-exception");
/**
 * Единый обработчик ошибок (ТЗ §45):
 * { success: false, error: { code, message, details? } }
 * Stack trace пользователю НЕ отдаём — только логируем на сервере (§45/§46).
 */
let AllExceptionsFilter = class AllExceptionsFilter {
    logger = new common_1.Logger("ExceptionFilter");
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let code = "INTERNAL_ERROR";
        let message = "Внутренняя ошибка сервера. Попробуйте позже.";
        let details;
        if (exception instanceof app_exception_1.AppException) {
            status = exception.getStatus();
            code = exception.code;
            message = exception.message;
            details = exception.details;
        }
        else if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            message =
                typeof res === "string"
                    ? res
                    : (res.message ??
                        exception.message);
            if (Array.isArray(message))
                message = message.join("; ");
            code =
                status === common_1.HttpStatus.BAD_REQUEST
                    ? "VALIDATION_FAILED"
                    : status === common_1.HttpStatus.UNAUTHORIZED
                        ? "UNAUTHORIZED"
                        : status === common_1.HttpStatus.FORBIDDEN
                            ? "FORBIDDEN"
                            : status === common_1.HttpStatus.NOT_FOUND
                                ? "NOT_FOUND"
                                : status === common_1.HttpStatus.CONFLICT
                                    ? "CONFLICT"
                                    : status === common_1.HttpStatus.TOO_MANY_REQUESTS
                                        ? "RATE_LIMITED"
                                        : "INTERNAL_ERROR";
            if (status >= 500)
                message = "Внутренняя ошибка сервера. Попробуйте позже.";
        }
        else if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            // Уникальные ограничения → понятные коды, без утечки SQL (§39)
            if (exception.code === "P2002") {
                status = common_1.HttpStatus.CONFLICT;
                code = "CONFLICT";
                message = "Значение уже используется (дубликат).";
                details = { fields: exception.meta?.target };
            }
            else if (exception.code === "P2025") {
                status = common_1.HttpStatus.NOT_FOUND;
                code = "NOT_FOUND";
                message = "Запись не найдена.";
            }
            else {
                status = common_1.HttpStatus.BAD_REQUEST;
                code = "VALIDATION_FAILED";
                message = "Ошибка запроса к данным.";
            }
        }
        else if (exception instanceof Error) {
            message = "Внутренняя ошибка сервера. Попробуйте позже.";
        }
        // Структурированный лог (§46): без secrets, без тела запроса с PII-полями паролей
        this.logger.error(JSON.stringify({
            level: "error",
            service: "api",
            requestId: request.headers["x-request-id"] ?? "-",
            method: request.method,
            path: request.url,
            status,
            code,
            message: exception instanceof Error ? exception.message : String(exception),
        }), exception instanceof Error && status >= 500 ? exception.stack : undefined);
        const body = {
            success: false,
            error: { code, message, ...(details !== undefined ? { details } : {}) },
        };
        void response.status(status).json(body);
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map