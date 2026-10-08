import {
  Body,
  Controller,
  UseGuards,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { TokensService } from "./tokens.service";
import { LoginDto } from "./dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("auth")
@Controller("api/auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
  ) {}

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Вход сотрудника (email + пароль)" })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...rest } = await this.auth.login(
      dto.email,
      dto.password,
      dto.remember === true,
    );
    this.tokens.setRefreshCookie(res, refreshToken, dto.remember === true);
    return { success: true, data: rest };
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({
    summary: "Продление сессии (httpOnly cookie, ротация refresh)",
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
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

  @Post("logout")
  @HttpCode(200)
  @ApiOperation({ summary: "Выход: очистка refresh-cookie" })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const header = req.headers.authorization;
    let userId: string | undefined;
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

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Текущий пользователь" })
  async me(@CurrentUser() user: { id: string }) {
    return { success: true, data: await this.auth.me(user.id) };
  }
}
