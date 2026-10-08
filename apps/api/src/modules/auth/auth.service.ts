import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TokensService } from './tokens.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../../common/app-exception';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRlc29tZXNhbHQ$dummyhashdummyhashdummyhashdummyhashdu';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
  ) {}

  static hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain);
  }

  private toSession(u: { id: string; email: string; firstName: string; lastName: string; role: string }): SessionUser {
    return { id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}`.trim(), role: u.role };
  }

  async validateUser(email: string, password: string): Promise<SessionUser> {
    if (!this.prisma.isHealthy()) throw AppException.forbidden('Сервис временно недоступен');
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Всегда выполняем argon2.verify, чтобы время ответа не выдавало существование аккаунта
    const ok = user?.passwordHash
      ? await argon2.verify(user.passwordHash, password).catch(() => false)
      : await argon2.verify(DUMMY_HASH, password).then(() => false).catch(() => false);
    if (!user || !ok || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    return this.toSession(user);
  }

  /** Логин: выдача пары токенов + хеш refresh-jti в БД (ротация, ТЗ §39). */
  async login(email: string, password: string, remember: boolean) {
    const user = await this.validateUser(email, password);
    const jti = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccess({ sub: user.id, email: user.email, role: user.role }),
      this.tokens.signRefresh({ sub: user.id, jti }),
    ]);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await argon2.hash(jti), refreshTokenIssuedAt: new Date() },
    });
    await this.audit.log({ userId: user.id, action: 'AUTH_LOGIN', entity: 'User', entityId: user.id, metadata: { remember } });
    return { user, accessToken, refreshToken, tokenType: 'Bearer' as const };
  }

  /** Refresh: проверка подписи + сверка хеша jti с БД, ротация (старый токен аннулируется). */
  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Сессия истекла, войдите снова');
    }
    if (!this.prisma.isHealthy()) throw new UnauthorizedException('Сервис временно недоступен');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.deletedAt || !user.refreshTokenHash) {
      throw new UnauthorizedException('Сессия недействительна');
    }
    const storedValid = await argon2.verify(user.refreshTokenHash, payload.jti).catch(() => false);
    if (!storedValid) {
      // Повторное использование украденного refresh-токена → разрываем сессию (§39)
      await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null, refreshTokenIssuedAt: null } });
      await this.audit.log({ userId: user.id, action: 'AUTH_REFRESH_REUSE_DETECTED', entity: 'User', entityId: user.id });
      throw new UnauthorizedException('Сессия завершена, войдите снова');
    }
    const jti = randomUUID();
    const [accessToken, newRefreshToken] = await Promise.all([
      this.tokens.signAccess({ sub: user.id, email: user.email, role: user.role }),
      this.tokens.signRefresh({ sub: user.id, jti }),
    ]);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await argon2.hash(jti), refreshTokenIssuedAt: new Date() },
    });
    return { user: this.toSession(user), accessToken, refreshToken: newRefreshToken, tokenType: 'Bearer' as const };
  }

  async logout(userId: string | undefined) {
    if (userId && this.prisma.isHealthy()) {
      await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null, refreshTokenIssuedAt: null } }).catch(() => undefined);
      await this.audit.log({ userId, action: 'AUTH_LOGOUT', entity: 'User', entityId: userId });
    }
    return { success: true };
  }

  async me(userId: string): Promise<SessionUser> {
    if (!this.prisma.isHealthy()) throw new UnauthorizedException('Сервис временно недоступен');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.deletedAt) throw new UnauthorizedException('Пользователь не найден');
    return this.toSession(user);
  }
}
