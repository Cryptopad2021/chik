import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { TokensService } from "./tokens.service";

/** Извлекает Bearer access-токен, проверяет подпись/тип, кладёт request.user. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokensService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new UnauthorizedException("Требуется авторизация");
    try {
      const payload = await this.tokens.verifyAccess(header.slice(7));
      (req as Request & { user?: unknown }).user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException("Токен недействителен или истёк");
    }
  }
}
