import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants';

const faqSchema = z.object({
  question: z.string().min(3).max(500),
  answer: z.string().min(3).max(5000),
  category: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).default(0),
  isPublished: z.boolean().default(true),
});

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}
  private get db() {
    if (!this.prisma.isHealthy()) throw new NotFoundException('Данные временно недоступны');
    return this.prisma;
  }
  listPublished() {
    return this.db.faq.findMany({ where: { isPublished: true }, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] });
  }
  listAll() {
    return this.db.faq.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] });
  }
  create(body: unknown) {
    const data = faqSchema.parse(body);
    return this.db.faq.create({ data });
  }
  async update(id: string, body: unknown) {
    const data = faqSchema.partial().parse(body);
    const r = await this.db.faq.update({ where: { id }, data }).catch(() => null);
    if (!r) throw new NotFoundException('FAQ не найден');
    return r;
  }
  async remove(id: string) {
    const r = await this.db.faq.delete({ where: { id } }).catch(() => null);
    if (!r) throw new NotFoundException('FAQ не найден');
    return { success: true };
  }
}

@ApiTags('faq')
@Controller('api/faq')
export class FaqController {
  constructor(private readonly faq: FaqService) {}

  @Get()
  @ApiOperation({ summary: 'Публичный список опубликованных FAQ' })
  published() {
    return this.faq.listPublished();
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TOUR_READ)
  all() {
    return this.faq.listAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TOUR_WRITE)
  create(@Body() body: unknown) {
    return this.faq.create(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TOUR_WRITE)
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.faq.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TOUR_WRITE)
  remove(@Param('id') id: string) {
    return this.faq.remove(id);
  }
}

@Module({
  imports: [AuthModule], controllers: [FaqController], providers: [FaqService] })
export class FaqModule {}
