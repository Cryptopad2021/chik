import {
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Body,
  Param,
  Post,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { AuthModule } from '../auth/auth.module';
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify, ensureUniqueSlug } from "../../common/slug";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PERMISSIONS } from "../../common/constants";

class UpsertDestinationDto {
  @IsString() @MaxLength(200) name!: string;
  @IsString() @IsOptional() @MaxLength(2000) description?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

@Injectable()
export class DestinationsService {
  constructor(private readonly prisma: PrismaService) {}
  private get db() {
    return this.prisma;
  }

  async list(includeHidden = false) {
    if (!this.prisma.isHealthy()) return [];
    return this.db.destination.findMany({
      where: includeHidden ? undefined : { isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { tours: true } } },
    });
  }
  async bySlug(slug: string) {
    const d = await this.db.destination.findFirst({
      where: { slug },
      include: {
        tours: {
          where: { status: "PUBLISHED", deletedAt: null },
          include: { images: { where: { isCover: true }, take: 1 } },
        },
      },
    });
    if (!d)
      throw new NotFoundException({
        code: "DESTINATION_NOT_FOUND",
        message: "Направление не найдено",
      });
    return d;
  }
  async create(dto: UpsertDestinationDto) {
    const base = slugify(dto.name);
    const slug = await ensureUniqueSlug(base, async (s) =>
      !!(await this.db.destination.findFirst({
        where: { slug: s },
        select: { id: true },
      })),
    );
    return this.db.destination.create({ data: { ...dto, slug } });
  }
  async update(id: string, dto: UpsertDestinationDto) {
    return this.db.destination.update({ where: { id }, data: dto });
  }
}

@ApiTags("destinations")
@Controller("api/destinations")
export class DestinationsController {
  constructor(
    private readonly svc: DestinationsService,
    private readonly jwt: JwtAuthGuard,
  ) {}
  @Get()
  @ApiOperation({ summary: "Список направлений" })
  async list() {
    return { success: true, data: await this.svc.list(false) };
  }
  @Get(":slug")
  @ApiOperation({ summary: "Направление с опубликованными турами" })
  async bySlug(@Param("slug") slug: string) {
    return { success: true, data: await this.svc.bySlug(slug) };
  }
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.TOUR_WRITE)
  @ApiOperation({ summary: "Создать направление (tour:write)" })
  async create(@Body() dto: UpsertDestinationDto) {
    return { success: true, data: await this.svc.create(dto) };
  }
  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.TOUR_WRITE)
  async update(@Param("id") id: string, @Body() dto: UpsertDestinationDto) {
    return { success: true, data: await this.svc.update(id, dto) };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [DestinationsController],
  providers: [DestinationsService],
  exports: [DestinationsService],
})
export class DestinationsModule {}
