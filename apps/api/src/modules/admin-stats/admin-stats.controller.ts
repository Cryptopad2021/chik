import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminStatsService } from './admin-stats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants';

@ApiTags('admin')
@Controller('api/admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({ summary: 'Метрики дашборда (ТЗ §19): заявки, выручка, заполняемость, ближайшие выезды' })
  async dashboard(@Query('days') days?: string) {
    const d = Math.min(Math.max(parseInt(days ?? '30', 10) || 30, 7), 90);
    return { success: true, data: await this.stats.dashboard(d) };
  }

  @Get('customers')
  @RequirePermissions(PERMISSIONS.CUSTOMER_READ)
  @ApiOperation({ summary: 'CRM: список клиентов с поиском и агрегатами (§23)' })
  async customers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return {
      success: true,
      data: await this.stats.customers({
        search,
        page: Number(page) || undefined,
        perPage: Number(perPage) || undefined,
      }),
    };
  }

  @Get('customers/:id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_READ)
  @ApiOperation({ summary: 'CRM: профиль клиента — поездки, суммы, история, комментарии (§23)' })
  async customer(@Param('id') id: string) {
    return { success: true, data: await this.stats.customerById(id) };
  }

  @Patch('customers/:id/note')
  @RequirePermissions(PERMISSIONS.CUSTOMER_WRITE)
  @ApiOperation({ summary: 'CRM: комментарий менеджера к профилю клиента (§23)' })
  async note(@Param('id') id: string, @Body('note') note: string | null) {
    return { success: true, data: await this.stats.updateCustomerNote(id, note ?? null) };
  }
}
