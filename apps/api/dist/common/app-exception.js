"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppException = void 0;
const common_1 = require("@nestjs/common");
/**
 * Доменное исключение с машинно-читаемым кодом ошибки (ТЗ §45).
 * Единый формат ответа формирует AllExceptionsFilter.
 */
class AppException extends common_1.HttpException {
    code;
    details;
    constructor(code, message, status, details) {
        super(message, status);
        this.code = code;
        this.details = details;
    }
    static notFound(code, message) {
        return new AppException(code, message, common_1.HttpStatus.NOT_FOUND);
    }
    static conflict(code, message, details) {
        return new AppException(code, message, common_1.HttpStatus.CONFLICT, details);
    }
    /** БД недоступна — 503 (код есть в ERROR_CODES @chirkey/types). */
    static databaseUnavailable() {
        return new AppException('DATABASE_UNAVAILABLE', 'Сервис временно недоступен', 503);
    }
    static validation(message, details) {
        return new AppException("VALIDATION_FAILED", message, common_1.HttpStatus.BAD_REQUEST, details);
    }
    static unauthorized(message = "Требуется авторизация") {
        return new AppException("UNAUTHORIZED", message, common_1.HttpStatus.UNAUTHORIZED);
    }
    static forbidden(message = "Недостаточно прав") {
        return new AppException("FORBIDDEN", message, common_1.HttpStatus.FORBIDDEN);
    }
    static departureClosed() {
        return new AppException("DEPARTURE_CLOSED", "Продажи на этот выезд закрыты", common_1.HttpStatus.CONFLICT);
    }
    static seatsInsufficient(available, requested) {
        return new AppException("SEATS_INSUFFICIENT", `Недостаточно мест: свободно ${available}, запрошено ${requested}`, common_1.HttpStatus.CONFLICT, { available, requested });
    }
}
exports.AppException = AppException;
//# sourceMappingURL=app-exception.js.map