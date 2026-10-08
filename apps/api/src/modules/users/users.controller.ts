import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS, Role } from '../../common/constants';
import { AuditService } from '../audit/audit.service';
import { createUserSchema, patchUserSchema } from './dto';

/** Валидация DTO через zod (ТЗ §1 server-side validation); ошибки — понятным сообщением. */
function parse<T>(schema: { safeParse: (d: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success || r.data === undefined) {
    throw new BadRequestException(r.error?.issues.map((i) => i.message).join('; ') ?? 'Некорректные данные');
  }
  return r.data;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.USER_MANAGE)
@Controller('api/users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Никогда не возвращаем passwordHash / refreshTokenHash (ТЗ §39). */
  private sanitize(u: Record<string, unknown>) {
    const { passwordHash: _p, refreshTokenHash: _r, ...safe } = u;
    return safe;
  }

  @Get()
  @ApiOperation({ summary: 'Список сотрудников (фильтр по роли, поиск)' })
  async list(@Query('role') role?: string, @Query('q') q?: string) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (role && Object.values(Role).includes(role as Role)) where.role = role;
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ];
    }
    const users = await this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    return { success: true, data: users.map((u) => this.sanitize(u)) };
  }

  @Post()
  @ApiOperation({ summary: 'Создать сотрудника (SUPER_ADMIN/ADMIN)' })
  async create(@Body() body: unknown, @CurrentUser() me: { id: string }) {
    const dto = parse(createUserSchema, body);
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (exists) throw new BadRequestException('Email уже занят');
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash: await argon2.hash(dto.password),
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
      },
    });
    await this.audit.log({ userId: me.id, action: 'USER_CREATE', entity: 'User', entityId: user.id, metadata: { role: dto.role } });
    return { success: true, data: this.sanitize(user) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Изменить сотрудника: роль / пароль / активность' })
  async patch(@Param('id') id: string, @Body() body: unknown, @CurrentUser() me: { id: string; role: string }) {
    const dto = parse(patchUserSchema, body);
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) throw new NotFoundException('Сотрудник не найден');
    // Изменять SUPER_ADMIN может только SUPER_ADMIN (§7)
    if (target.role === Role.SUPER_ADMIN && me.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Только супер-администратор может изменять супер-администратора');
    }
    const data: Record<string, unknown> = {};
    if (dto.firstName) data.firstName = dto.firstName;
    if (dto.lastName) data.lastName = dto.lastName;
    if (dto.role) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await argon2.hash(dto.password);
    const updated = await this.prisma.user.update({ where: { id }, data });
    await this.audit.log({
      userId: me.id,
      action: 'USER_UPDATE',
      entity: 'User',
      entityId: id,
      metadata: { fields: Object.keys(dto), roleChanged: dto.role ? `${target.role}→${dto.role}` : undefined },
    });
    return { success: true, data: this.sanitize(updated) };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Деактивировать (soft-delete) сотрудника' })
  async remove(@Param('id') id: string, @CurrentUser() me: { id: string; role: string }) {
    if (id === me.id) throw new ForbiddenException('Нельзя удалить самого себя');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) throw new NotFoundException('Сотрудник не найден');
    if (target.role === Role.SUPER_ADMIN && me.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Только супер-администратор может удалять супер-администратора');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, refreshTokenHash: null },
    });
    await this.audit.log({ userId: me.id, action: 'USER_DELETE', entity: 'User', entityId: id });
    return { success: true, data: { id: updated.id } };
  }
}
