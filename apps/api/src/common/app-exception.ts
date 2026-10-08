import { HttpException, HttpStatus } from "@nestjs/common";
import type { ErrorCode } from "@chirkey/types";

/**
 * Доменное исключение с машинно-читаемым кодом ошибки (ТЗ §45).
 * Единый формат ответа формирует AllExceptionsFilter.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: unknown,
  ) {
    super(message, status);
  }

  static notFound(code: ErrorCode, message: string): AppException {
    return new AppException(code, message, HttpStatus.NOT_FOUND);
  }

  static conflict(
    code: ErrorCode,
    message: string,
    details?: unknown,
  ): AppException {
    return new AppException(code, message, HttpStatus.CONFLICT, details);
  }

  /** БД недоступна — 503 (код есть в ERROR_CODES @chirkey/types). */
  static databaseUnavailable(): AppException {
    return new AppException('DATABASE_UNAVAILABLE' as never, 'Сервис временно недоступен', 503);
  }

  static validation(message: string, details?: unknown): AppException {
    return new AppException(
      "VALIDATION_FAILED",
      message,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }

  static unauthorized(message = "Требуется авторизация"): AppException {
    return new AppException("UNAUTHORIZED", message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(message = "Недостаточно прав"): AppException {
    return new AppException("FORBIDDEN", message, HttpStatus.FORBIDDEN);
  }

  static departureClosed(): AppException {
    return new AppException(
      "DEPARTURE_CLOSED",
      "Продажи на этот выезд закрыты",
      HttpStatus.CONFLICT,
    );
  }

  static seatsInsufficient(available: number, requested: number): AppException {
    return new AppException(
      "SEATS_INSUFFICIENT",
      `Недостаточно мест: свободно ${available}, запрошено ${requested}`,
      HttpStatus.CONFLICT,
      { available, requested },
    );
  }
}
