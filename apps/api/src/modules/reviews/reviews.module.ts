import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

class CreateReviewDto {
  @ApiProperty() @IsString() tourId!: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @MaxLength(4000) text!: string;
  @IsString() @MaxLength(200) authorName!: string;
  @IsOptional() @IsString() @MaxLength(200) contact?: string; // телефон/email для модерации — не публикуется
}
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() { return this.prisma; }

  async publicList(tourId?: string) {
    if (!this.prisma.isHealthy()) return [];
    return this.db.review.findMany({
      where: { status: 'APPROVED', ...(tourId ? { tourId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { tour: { select: { title: true, slug: true } }, customer: { select: { firstName: true, lastName: true } } },
      // authorName в выборку не попадает — это служебное поле модерации (ТЗ §72)
    });
  }

  async adminList(status?: ReviewStatus) {
    if (!this.prisma.isHealthy()) return [];
    return this.db.review.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { tour: { select: { title: true } }, moderations: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async create(dto: CreateReviewDto) {
    const tour = await this.db.tour.findFirst({ where: { id: dto.tourId, deletedAt: null } });
    if (!tour) throw new NotFoundException({ code: 'TOUR_NOT_FOUND', message: 'Тур не найден' });
    // Анти-спам: не более одного PENDING-отзыва с того же имени на тур в сутки
    const since = new Date(Date.now() - 86400000);
    const recent = await this.db.review.findFirst({ where: { tourId: dto.tourId, authorName: dto.authorName, createdAt: { gte: since } } });
    if (recent) throw new BadRequestException({ code: 'REVIEW_TOO_FREQUENT', message: 'Вы уже оставляли отзыв недавно. Попробуйте позже.' });
    return this.db.review.create({
      data: {
        tourId: dto.tourId,
        rating: dto.rating,
        text: dto.text,
        authorName: dto.authorName,
        status: 'PENDING',
      },
      select: { id: true, status: true, createdAt: true },
    });
  }

  async moderate(id: string, status: 'APPROVED' | 'REJECTED', userId: string, note?: string) {
    const r = await this.db.review.findUnique({ where: { id } });
    if (!r) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND', message: 'Отзыв не найден' });
    const updated = await this.db.review.update({ where: { id }, data: { status } });
    await this.db.reviewModeration.create({ data: { reviewId: id, action: status, userId, note: note ?? null } });
    return updated;
  }
}

@ApiTags('reviews')
@Controller('api/reviews')
export class ReviewsController {
  constructor(private readonly svc: ReviewsService, private readonly audit: AuditService) {}

  @Get() @ApiOperation({ summary: 'Публикуются только APPROVED отзывы (ТЗ §22)' })
  async list(@Query('tourId') tourId?: string) { return { success: true, data: await this.svc.publicList(tourId) }; }

  @Post() @ApiOperation({ summary: 'Оставить отзыв (падает в PENDING до модерации)' })
  async create(@Body() dto: CreateReviewDto) { return { success: true, data: await this.svc.create(dto) }; }

  @Get('admin/all') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions(PERMISSIONS.REVIEW_READ)
  @ApiOperation({ summary: 'Все отзывы для модерации (review:read)' })
  async adminList(@Query('status') status?: string) {
    const valid = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? (status as ReviewStatus) : undefined;
    if (status && !valid) throw new BadRequestException({ code: 'INVALID_STATUS', message: 'Некорректный статус отзыва' });
    return { success: true, data: await this.svc.adminList(valid) };
  }

  @Patch(':id/moderate') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions(PERMISSIONS.REVIEW_MODERATE)
  @ApiOperation({ summary: 'Модерация: APPROVED/REJECTED (review:moderate)' })
  async moderate(@Param('id') id: string, @Body('status') status: 'APPROVED' | 'REJECTED', @Body('note') note: string | undefined, @CurrentUser() user: AuthUser) {
    if (!['APPROVED', 'REJECTED'].includes(status)) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Статус должен быть APPROVED или REJECTED' });
    const r = await this.svc.moderate(id, status, user.id, note);
    await this.audit.log({ userId: user.id, action: 'REVIEW_MODERATED', entity: 'Review', entityId: id, metadata: { status } });
    return { success: true, data: r };
  }
}

@Module({
  imports: [AuthModule], controllers: [ReviewsController], providers: [ReviewsService], exports: [ReviewsService] })
export class ReviewsModule {}
