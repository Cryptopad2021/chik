import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TrackBatchDto, TrackEventDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants';

/** Публичный приём событий с публичного сайта (ТЗ 12.1). Без авторизации, только whitelist-типы, без ПДн (§72). */
@ApiTags('analytics')
@Controller('api/analytics')
export class AnalyticsPublicController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('events')
  @ApiOperation({ summary: 'Записать событие аналитики (whitelist типов, ПДн отбрасываются)' })
  async track(@Body() dto: TrackEventDto) {
    const res = await this.analytics.track(dto);
    return { success: true, data: res };
  }

  @Post('events/batch')
  @ApiOperation({ summary: 'Пакетная запись событий (до 50 за запрос)' })
  async trackBatch(@Body() dto: TrackBatchDto) {
    const res = await this.analytics.trackBatch(dto.events);
    return { success: true, data: res };
  }
}

/** Админские агрегаты (ТЗ 12.2 / §73). */
@ApiTags('admin')
@Controller('api/admin/analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AnalyticsAdminController {
  constructor(private readonly analytics: AnalyticsService) {}

  private days(days?: string): number {
    return Math.min(Math.max(parseInt(days ?? '30', 10) || 30, 1), 365);
  }

  @Get('funnel')
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({ summary: 'Воронка view→select→start→created→confirmed + конверсия' })
  async funnel(@Query('days') days?: string) {
    return { success: true, data: await this.analytics.funnel(this.days(days)) };
  }

  @Get('events-by-day')
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({ summary: 'События по дням (опционально фильтр по типу)' })
  async eventsByDay(@Query('days') days?: string, @Query('type') type?: string) {
    return { success: true, data: await this.analytics.eventsByDay(this.days(days), type) };
  }

  @Get('top-tours')
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({ summary: 'Топ туров: просмотры, выбор дат, созданные заявки' })
  async topTours(@Query('days') days?: string, @Query('limit') limit?: string) {
    const l = Math.min(Math.max(parseInt(limit ?? '10', 10) || 10, 1), 50);
    return { success: true, data: await this.analytics.topTours(this.days(days), l) };
  }

  @Get('utm')
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({ summary: 'Разрез по UTM-меткам' })
  async utm(@Query('days') days?: string) {
    return { success: true, data: await this.analytics.utmBreakdown(this.days(days)) };
  }

  @Get('telegram')
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({ summary: 'Telegram: клики по кнопкам публикаций + число публикаций' })
  async telegram(@Query('days') days?: string) {
    return { success: true, data: await this.analytics.telegramStats(this.days(days)) };
  }
}
