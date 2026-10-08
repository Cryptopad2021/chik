import { Body, Controller, Get, Injectable, Module, Post, UseGuards } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants';

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Укажите корректный телефон'),
  email: z.string().email().nullish(),
  message: z.string().max(2000).nullish(),
  source: z.enum(['WEBSITE', 'TELEGRAM', 'PHONE', 'OTHER']).default('WEBSITE'),
});

@Injectable()
export class ContactRequestsService {
  constructor(private readonly prisma: PrismaService) {}
  create(body: unknown) {
    const data = contactSchema.parse(body);
    if (!this.prisma.isHealthy()) throw new Error('db');
    return this.prisma.contactRequest.create({ data });
  }
  list() {
    if (!this.prisma.isHealthy()) throw new Error('db');
    return this.prisma.contactRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }
}

@ApiTags('contact-requests')
@Controller('api/contact-requests')
export class ContactRequestsController {
  constructor(private readonly svc: ContactRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Форма «Задать вопрос» (публичная, rate-limited глобально)' })
  create(@Body() body: unknown) {
    return this.svc.create(body);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  list() {
    return this.svc.list();
  }
}

@Module({
  imports: [AuthModule], controllers: [ContactRequestsController], providers: [ContactRequestsService] })
export class ContactRequestsModule {}
