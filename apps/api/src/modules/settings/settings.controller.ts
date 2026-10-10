import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

@ApiTags('settings')
@Controller('api/settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get('public')
  @ApiOperation({ summary: 'Публичные настройки: контакты, hero, Telegram-CTA (без секретов)' })
  public() {
    return this.settings.publicSettings();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SETTINGS_WRITE)
  @ApiOperation({ summary: 'Полный набор настроек для админки (settings:write)' })
  admin() {
    return this.settings.adminSettings();
  }

  @Patch('admin')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SETTINGS_WRITE)
  @ApiOperation({ summary: 'Обновление настроек сайта (settings:write, только SUPER_ADMIN по матрице §7)' })
  async patch(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    const updated = await this.settings.update(body);
    await this.audit.log({
      userId: user.id,
      action: 'SETTINGS_UPDATED',
      entity: 'SiteSettings',
      entityId: 'singleton',
      metadata: { fields: Object.keys(body) },
    });
    return { success: true, data: updated };
  }
}
