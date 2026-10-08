import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Permission, Role, roleHasPermission } from "../constants";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as
      { role?: Role } | undefined;
    if (!user) throw new UnauthorizedException("Требуется авторизация");
    const ok = required.every(
      (p) => user.role && roleHasPermission(user.role, p),
    );
    if (!ok)
      throw new ForbiddenException("Недостаточно прав для этого действия");
    return true;
  }
}
