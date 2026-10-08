"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokensService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
/**
 * JWT access + refresh с httpOnly cookie для refresh (ТЗ §2 auth, §39 secure cookies).
 * Access короткоживущий (15m) в Authorization: Bearer; refresh (30d) — только httpOnly cookie
 * c путём /api/auth и ротацией при каждом обновлении.
 */
let TokensService = class TokensService {
    jwt;
    config;
    constructor(jwt, config) {
        this.jwt = jwt;
        this.config = config;
    }
    get secrets() {
        return {
            access: this.config.get('JWT_SECRET') ?? 'dev-only-secret-change-me',
            refresh: this.config.get('JWT_REFRESH_SECRET') ?? 'dev-only-refresh-change-me',
        };
    }
    async signAccess(payload) {
        return this.jwt.signAsync({ ...payload, type: 'access' }, { secret: this.secrets.access, expiresIn: '15m' });
    }
    async signRefresh(payload) {
        return this.jwt.signAsync({ ...payload, type: 'refresh' }, { secret: this.secrets.refresh, expiresIn: '30d' });
    }
    async verifyAccess(token) {
        return this.jwt.verifyAsync(token, { secret: this.secrets.access });
    }
    async verifyRefresh(token) {
        const p = await this.jwt.verifyAsync(token, { secret: this.secrets.refresh });
        if (p.type !== 'refresh')
            throw new Error('wrong token type');
        return p;
    }
    setRefreshCookie(res, token, remember) {
        res.cookie('rt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/api/auth',
            maxAge: remember ? 30 * 24 * 3600 * 1000 : undefined, // без "remember me" — session cookie
        });
    }
    clearRefreshCookie(res) {
        res.clearCookie('rt', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth' });
    }
    readRefreshCookie(req) {
        const v = req.cookies?.['rt'];
        return typeof v === 'string' ? v : undefined;
    }
};
exports.TokensService = TokensService;
exports.TokensService = TokensService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], TokensService);
//# sourceMappingURL=tokens.service.js.map