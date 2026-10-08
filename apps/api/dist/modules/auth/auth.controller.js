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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("./auth.service");
const tokens_service_1 = require("./tokens.service");
const dto_1 = require("./dto");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let AuthController = class AuthController {
    auth;
    tokens;
    constructor(auth, tokens) {
        this.auth = auth;
        this.tokens = tokens;
    }
    async login(dto, res) {
        const { refreshToken, ...rest } = await this.auth.login(dto.email, dto.password, dto.remember === true);
        this.tokens.setRefreshCookie(res, refreshToken, dto.remember === true);
        return { success: true, data: rest };
    }
    async refresh(req, res) {
        const rt = this.tokens.readRefreshCookie(req);
        if (!rt)
            return {
                success: false,
                error: { code: "NO_REFRESH_COOKIE", message: "Нет сессии" },
            };
        const { refreshToken, ...rest } = await this.auth.refresh(rt);
        this.tokens.setRefreshCookie(res, refreshToken, true);
        return { success: true, data: rest };
    }
    async logout(req, res) {
        const header = req.headers.authorization;
        let userId;
        if (header?.startsWith("Bearer ")) {
            userId = await this.tokens
                .verifyAccess(header.slice(7))
                .then((p) => p.sub)
                .catch(() => undefined);
        }
        await this.auth.logout(userId);
        this.tokens.clearRefreshCookie(res);
        return { success: true };
    }
    async me(user) {
        return { success: true, data: await this.auth.me(user.id) };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)("login"),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({ summary: "Вход сотрудника (email + пароль)" }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)("refresh"),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: "Продление сессии (httpOnly cookie, ротация refresh)",
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)("logout"),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({ summary: "Выход: очистка refresh-cookie" }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)("me"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: "Текущий пользователь" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)("auth"),
    (0, common_1.Controller)("api/auth"),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        tokens_service_1.TokensService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map