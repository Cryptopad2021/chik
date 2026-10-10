import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramPublicationService } from './telegram-publication.service';
import { TelegramService } from './telegram.service';
import { TEMPLATE_VARIABLES } from './template';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../../common/app-exception';

/**
 * Telegram endpoints (ТЗ §47, Phase 10.2/10.4/10.5).
 * - POST /api/telegram/webhook — входящие апдейты бота; секрет X-Telegram-Bot-Api-Secret-Token (§39);
 * - админские маршруты — под JWT + PERMISSIONS.TELEGRAM_PUBLISH (§7).
 */
@ApiTags('telegram')
@Controller('api/telegram')
export class TelegramController {
  constructor(
    private readonly bot: TelegramBotService,
    private readonly publication: TelegramPublicationService,
    private readonly telegram: TelegramService,
    private readonly audit: AuditService,
  ) {}

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook Bot API (проверка secret_token, ТЗ 10.2)' })
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: Record<string, unknown>,
  ) {
    if (!this.telegram.verifyWebhookSecret(secret)) {
      // без секрета обработку не начинаем; тело не логируем (§46)
      throw AppException.forbidden('Неверный секрет webhook');
    }
    void this.bot.handleUpdate(update).catch(() => undefined); // быстрый 200, логика асинхронно
    return { received: true };
  }

  @Get('posts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TELEGRAM_PUBLISH)
  @ApiOperation({ summary: 'Список публикаций TelegramPost (telegram:publish)' })
  async posts(@Query('limit') limit?: string) {
    const n = Math.min(Math.max(parseInt(limit ?? '50', 10) || 50, 1), 200);
    return { success: true, data: await this.publication.listPosts(n) };
  }

  @Get('template-variables')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TELEGRAM_PUBLISH)
  @ApiOperation({ summary: 'Доступные переменные шаблона (редактор админки, ТЗ 10.5)' })
  templateVariables() {
    return { success: true, data: TEMPLATE_VARIABLES };
  }

  @Post('departures/:id/preview')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TELEGRAM_PUBLISH)
  @ApiOperation({ summary: 'Preview поста по шаблону без отправки (ТЗ 10.5)' })
  async preview(@Param('id') id: string, @Body() body: { template?: string | null }) {
    const data = await this.publication.preview(id, body?.template ?? null);
    return { success: true, data };
  }

  @Post('departures/:id/publish')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TELEGRAM_PUBLISH)
  @ApiOperation({ summary: 'Опубликовать выезд в Telegram-канал (ТЗ §33)' })
  async publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const res = await this.publication.publish(id, user.id);
    await this.audit.log({
      userId: user.id,
      action: res.sent ? 'TELEGRAM_PUBLISHED' : 'TELEGRAM_PUBLISH_DRY_RUN',
      entity: 'TelegramPost',
      entityId: res.post.id,
      metadata: { departureId: id, dryRun: res.dryRun, status: res.post.status },
    });
    return { success: true, data: res };
  }
}
