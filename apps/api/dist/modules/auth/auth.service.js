"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const argon2 = __importStar(require("argon2"));
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const tokens_service_1 = require("./tokens.service");
const audit_service_1 = require("../audit/audit.service");
const app_exception_1 = require("../../common/app-exception");
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRlc29tZXNhbHQ$dummyhashdummyhashdummyhashdummyhashdu';
let AuthService = class AuthService {
    prisma;
    tokens;
    audit;
    constructor(prisma, tokens, audit) {
        this.prisma = prisma;
        this.tokens = tokens;
        this.audit = audit;
    }
    static hashPassword(plain) {
        return argon2.hash(plain);
    }
    toSession(u) {
        return { id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}`.trim(), role: u.role };
    }
    async validateUser(email, password) {
        if (!this.prisma.isHealthy())
            throw app_exception_1.AppException.forbidden('Сервис временно недоступен');
        const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        // Всегда выполняем argon2.verify, чтобы время ответа не выдавало существование аккаунта
        const ok = user?.passwordHash
            ? await argon2.verify(user.passwordHash, password).catch(() => false)
            : await argon2.verify(DUMMY_HASH, password).then(() => false).catch(() => false);
        if (!user || !ok || !user.isActive || user.deletedAt) {
            throw new common_1.UnauthorizedException('Неверный email или пароль');
        }
        return this.toSession(user);
    }
    /** Логин: выдача пары токенов + хеш refresh-jti в БД (ротация, ТЗ §39). */
    async login(email, password, remember) {
        const user = await this.validateUser(email, password);
        const jti = (0, node_crypto_1.randomUUID)();
        const [accessToken, refreshToken] = await Promise.all([
            this.tokens.signAccess({ sub: user.id, email: user.email, role: user.role }),
            this.tokens.signRefresh({ sub: user.id, jti }),
        ]);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { refreshTokenHash: await argon2.hash(jti), refreshTokenIssuedAt: new Date() },
        });
        await this.audit.log({ userId: user.id, action: 'AUTH_LOGIN', entity: 'User', entityId: user.id, metadata: { remember } });
        return { user, accessToken, refreshToken, tokenType: 'Bearer' };
    }
    /** Refresh: проверка подписи + сверка хеша jti с БД, ротация (старый токен аннулируется). */
    async refresh(refreshToken) {
        let payload;
        try {
            payload = await this.tokens.verifyRefresh(refreshToken);
        }
        catch {
            throw new common_1.UnauthorizedException('Сессия истекла, войдите снова');
        }
        if (!this.prisma.isHealthy())
            throw new common_1.UnauthorizedException('Сервис временно недоступен');
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user || !user.isActive || user.deletedAt || !user.refreshTokenHash) {
            throw new common_1.UnauthorizedException('Сессия недействительна');
        }
        const storedValid = await argon2.verify(user.refreshTokenHash, payload.jti).catch(() => false);
        if (!storedValid) {
            // Повторное использование украденного refresh-токена → разрываем сессию (§39)
            await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null, refreshTokenIssuedAt: null } });
            await this.audit.log({ userId: user.id, action: 'AUTH_REFRESH_REUSE_DETECTED', entity: 'User', entityId: user.id });
            throw new common_1.UnauthorizedException('Сессия завершена, войдите снова');
        }
        const jti = (0, node_crypto_1.randomUUID)();
        const [accessToken, newRefreshToken] = await Promise.all([
            this.tokens.signAccess({ sub: user.id, email: user.email, role: user.role }),
            this.tokens.signRefresh({ sub: user.id, jti }),
        ]);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { refreshTokenHash: await argon2.hash(jti), refreshTokenIssuedAt: new Date() },
        });
        return { user: this.toSession(user), accessToken, refreshToken: newRefreshToken, tokenType: 'Bearer' };
    }
    async logout(userId) {
        if (userId && this.prisma.isHealthy()) {
            await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null, refreshTokenIssuedAt: null } }).catch(() => undefined);
            await this.audit.log({ userId, action: 'AUTH_LOGOUT', entity: 'User', entityId: userId });
        }
        return { success: true };
    }
    async me(userId) {
        if (!this.prisma.isHealthy())
            throw new common_1.UnauthorizedException('Сервис временно недоступен');
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.isActive || user.deletedAt)
            throw new common_1.UnauthorizedException('Пользователь не найден');
        return this.toSession(user);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tokens_service_1.TokensService,
        audit_service_1.AuditService])
], AuthService);
//# sourceMappingURL=auth.service.js.map