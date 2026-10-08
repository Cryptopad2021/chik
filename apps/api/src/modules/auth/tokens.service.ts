import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access';
}
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

/**
 * JWT access + refresh с httpOnly cookie для refresh (ТЗ §2 auth, §39 secure cookies).
 * Access короткоживущий (15m) в Authorization: Bearer; refresh (30d) — только httpOnly cookie
 * c путём /api/auth и ротацией при каждом обновлении.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get secrets() {
    return {
      access: this.config.get<string>('JWT_SECRET') ?? 'dev-only-secret-change-me',
      refresh: this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-only-refresh-change-me',
    };
  }

  async signAccess(payload: Omit<AccessTokenPayload, 'type'>): Promise<string> {
    return this.jwt.signAsync({ ...payload, type: 'access' }, { secret: this.secrets.access, expiresIn: '15m' });
  }

  async signRefresh(payload: Omit<RefreshTokenPayload, 'type'>): Promise<string> {
    return this.jwt.signAsync({ ...payload, type: 'refresh' }, { secret: this.secrets.refresh, expiresIn: '30d' });
  }

  async verifyAccess(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.secrets.access });
  }

  async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    const p = await this.jwt.verifyAsync<RefreshTokenPayload & { type?: string }>(token, { secret: this.secrets.refresh });
    if (p.type !== 'refresh') throw new Error('wrong token type');
    return p;
  }

  setRefreshCookie(res: Response, token: string, remember: boolean): void {
    res.cookie('rt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: remember ? 30 * 24 * 3600 * 1000 : undefined, // без "remember me" — session cookie
    });
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie('rt', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth' });
  }

  readRefreshCookie(req: Request): string | undefined {
    const v = req.cookies?.['rt'];
    return typeof v === 'string' ? v : undefined;
  }
}
