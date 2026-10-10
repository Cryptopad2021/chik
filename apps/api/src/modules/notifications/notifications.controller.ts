import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants';

/** Лента уведомлений для админки (ТЗ Phase 11.5). */
@ApiTags('admin')
@Controller('api/admin/notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({ summary: 'Список уведомлений: фильтры status/event, пагинация' })
  async list(
    @Query('status') status?: string,
    @Query('event') event?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return {
      success: true,
      data: await this.notifications.list({
        status,
        event,
        page: Math.max(Number(page) || 1, 1),
        perPage: Math.min(Math.max(Number(perPage) || 20, 1), 100),
      }),
    };
  }

  @Post('retry-failed')
  @RequirePermissions(PERMISSIONS.BOOKING_MANAGE)
  @ApiOperation({ summary: 'Повторить отправку FAILED-уведомлений (ручной запуск, дубль cron-задачи)' })
  async retryFailed(@Body('limit') limit?: number) {
    const sent = await this.notifications.retryFailed(Math.min(Number(limit) || 20, 100));
    return { success: true, data: { retriedSent: sent } };
  }
}
