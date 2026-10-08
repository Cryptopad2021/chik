import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DepartureStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/app-exception';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/constants';
import { AuditService } from '../audit/audit.service';
import {
  CreateDepartureDto,
  DEPARTURE_STATUSES,
  ListDeparturesQuery,
  UpdateDepartureDto,
} from './dto';

type StatusValue = (typeof DEPARTURE_STATUSES)[keyof typeof DEPARTURE_STATUSES];

/** Статусы, при которых продажи закрыты и менять состав нельзя. */
const CLOSED_STATUSES: StatusValue[] = ['CANCELLED', 'COMPLETED'];

@Injectable()
export class DeparturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    if (!this.prisma.isHealthy()) throw AppException.databaseUnavailable();
    return this.prisma;
  }

  /** availableSeats — вычисляемое поле (ТЗ §12). */
  private decorate<T extends { totalSeats: number; bookedSeats: number; price: unknown }>(d: T) {
    const availableSeats = Math.max(d.totalSeats - d.bookedSeats, 0);
    return {
      ...d,
      price: Number(d.price),
      availableSeats,
      fillPercent: d.totalSeats > 0 ? Math.round((d.bookedSeats / d.totalSeats) * 100) : 0,
    };
  }

  async list(query: ListDeparturesQuery) {
    if (!this.prisma.isHealthy()) return [];
    const where: Record<string, unknown> = {};
    if (query.tourId) where.tourId = query.tourId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.startDate = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }
    if (query.upcomingOnly === 'true') {
      where.startDate = { ...(where.startDate as object), gte: new Date() };
      where.status = where.status ?? { in: ['OPEN', 'ALMOST_FULL'] };
    }
    if (query.citySlug) {
      where.cities = { some: { departureCity: { slug: query.citySlug, isActive: true } } };
    }
    const items = await this.db.departure.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: {
        tour: { select: { id: true, slug: true, title: true } },
        cities: { include: { departureCity: { select: { id: true, name: true, slug: true } } } },
      },
    });
    return items.map((d) => this.decorate(d));
  }

  async byId(id: string) {
    const d = await this.db.departure.findUnique({
      where: { id },
      include: {
        tour: { select: { id: true, slug: true, title: true, adultPrice: true, child10to14Price: true, childUnder10Price: true } },
        cities: { include: { departureCity: true } },
      },
    });
    if (!d) throw new AppException('DEPARTURE_NOT_FOUND', 'Выезд не найден', 404);
    return this.decorate(d);
  }

  private validateDates(startDate: string, endDate: string) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      throw new BadRequestException({ code: 'INVALID_DATES', message: 'Некорректные даты' });
    }
    if (e < s) {
      throw new BadRequestException({
        code: 'END_BEFORE_START',
        message: 'Дата окончания раньше даты начала',
      });
    }
    return { s, e };
  }

  async create(dto: CreateDepartureDto, userId: string) {
    const tour = await this.db.tour.findFirst({ where: { id: dto.tourId, deletedAt: null } });
    if (!tour) throw new AppException('TOUR_NOT_FOUND', 'Тур не найден', 404);
    const { s, e } = this.validateDates(dto.startDate, dto.endDate);
    await this.assertCitiesExist(dto.cities?.map((c) => c.departureCityId) ?? []);

    const created = await this.db.departure.create({
      data: {
        tourId: dto.tourId,
        startDate: s,
        endDate: e,
        totalSeats: dto.totalSeats,
        price: dto.price,
        status: (dto.status ?? 'OPEN') as DepartureStatus,
        notes: dto.notes,
        cities: dto.cities?.length
          ? { create: dto.cities.map((c) => ({ departureCityId: c.departureCityId, price: c.price, notes: c.notes })) }
          : undefined,
      },
      include: { cities: { include: { departureCity: true } } },
    });
    await this.audit.log({ userId, action: 'DEPARTURE_CREATED', entity: 'Departure', entityId: created.id, metadata: { tourId: dto.tourId, startDate: dto.startDate } });
    return this.decorate(created);
  }

  async update(id: string, dto: UpdateDepartureDto, userId: string) {
    const existing = await this.db.departure.findUnique({ where: { id } });
    if (!existing) throw new AppException('DEPARTURE_NOT_FOUND', 'Выезд не найден', 404);

    if (CLOSED_STATUSES.includes(existing.status as StatusValue) && (dto.cities || dto.startDate)) {
      throw new ConflictException({
        code: 'DEPARTURE_CLOSED',
        message: 'Нельзя редактировать даты/города закрытого выезда',
      });
    }

    const data: Record<string, unknown> = {};
    if (dto.startDate || dto.endDate) {
      const { s, e } = this.validateDates(dto.startDate ?? existing.startDate.toISOString(), dto.endDate ?? existing.endDate.toISOString());
      // Нельзя увести выезд в прошлое, если есть активные брони
      const activeBookings = await this.db.booking.count({
        where: { departureId: id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      });
      if (activeBookings > 0 && s.getTime() < Date.now()) {
        throw new ConflictException({
          code: 'DEPARTURE_HAS_BOOKINGS',
          message: 'У выезда есть активные брони — нельзя переносить в прошлое',
        });
      }
      data.startDate = s;
      data.endDate = e;
    }
    if (dto.cities) {
      await this.assertCitiesExist(dto.cities.map((c) => c.departureCityId));
      await this.db.departureCityOnDeparture.deleteMany({ where: { departureId: id } });
      data.cities = { create: dto.cities.map((c) => ({ departureCityId: c.departureCityId, price: c.price, notes: c.notes })) };
    }
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.price !== undefined) data.price = dto.price;

    if (dto.totalSeats !== undefined) {
      // Уменьшать ниже забронированного нельзя — защита от рассогласования мест (§54)
      if (dto.totalSeats < existing.bookedSeats) {
        throw new ConflictException({
          code: 'SEATS_BELOW_BOOKED',
          message: `Нельзя уменьшить количество мест ниже уже забронированных (${existing.bookedSeats})`,
        });
      }
      data.totalSeats = dto.totalSeats;
    }
    if (dto.status) data.status = dto.status;

    const updated = await this.db.departure.update({
      where: { id },
      data,
      include: { cities: { include: { departureCity: true } } },
    });
    await this.audit.log({ userId, action: 'DEPARTURE_UPDATED', entity: 'Departure', entityId: id, metadata: dto as unknown as Record<string, unknown> });
    return this.decorate(updated);
  }

  /** Закрытие продаж (§21): OPEN → CANCELLED без потерь мест. */
  async closeSales(id: string, userId: string) {
    const d = await this.db.departure.findUnique({ where: { id } });
    if (!d) throw new AppException('DEPARTURE_NOT_FOUND', 'Выезд не найден', 404);
    if (d.status === 'COMPLETED') throw new ConflictException('Завершённый выезд нельзя закрыть');
    const updated = await this.db.departure.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.audit.log({ userId, action: 'DEPARTURE_SALES_CLOSED', entity: 'Departure', entityId: id, metadata: { from: d.status } });
    return updated;
  }

  private async assertCitiesExist(ids: string[]) {
    if (!ids.length) return;
    const found = await this.db.departureCity.count({ where: { id: { in: ids }, isActive: true } });
    if (found !== new Set(ids).size) {
      throw new BadRequestException({ code: 'CITY_NOT_AVAILABLE', message: 'Один или несколько городов недоступны' });
    }
  }
}

@ApiTags('departures')
@Controller('api/departures')
export class DeparturesController {
  constructor(private readonly svc: DeparturesService) {}

  @Get()
  @ApiOperation({ summary: 'Расписание выездов (публичное)' })
  async list(@Query() q: ListDeparturesQuery) {
    return { success: true, data: await this.svc.list(q) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Выезд по id' })
  async one(@Param('id') id: string) {
    return { success: true, data: await this.svc.byId(id) };
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.DEPARTURE_WRITE)
  @ApiOperation({ summary: 'Создать выезд' })
  async create(@Body() dto: CreateDepartureDto, @CurrentUser('sub') userId: string) {
    return { success: true, data: await this.svc.create(dto, userId) };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.DEPARTURE_WRITE)
  @ApiOperation({ summary: 'Изменить выезд' })
  async update(@Param('id') id: string, @Body() dto: UpdateDepartureDto, @CurrentUser('sub') userId: string) {
    return { success: true, data: await this.svc.update(id, dto, userId) };
  }

  @Patch(':id/close-sales')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.DEPARTURE_WRITE)
  @ApiOperation({ summary: 'Закрыть продажи выезда' })
  async close(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return { success: true, data: await this.svc.closeSales(id, userId) };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [DeparturesController],
  providers: [DeparturesService],
  exports: [DeparturesService],
})
export class DeparturesModule {}
