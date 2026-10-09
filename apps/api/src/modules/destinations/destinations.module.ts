import {
  Controller,
  Delete,
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
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";
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
  // Hero-карусель главной (управляется из админки)
  @IsString() @IsOptional() @MaxLength(500) heroSlideImageUrl?: string | null;
  @IsString() @IsOptional() @MaxLength(200) heroSlideTitle?: string | null;
  @IsString() @IsOptional() @MaxLength(500) heroSlideText?: string | null;
  @IsBoolean() @IsOptional() showInHero?: boolean;
  @IsOptional() heroSortOrder?: number;
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
  /**
   * Слайды hero-карусели главной: направления с showInHero=true.
   * Клик ведёт на главный тур слайда (первый опубликованный), иначе — на страницу направления.
   */
  async heroSlides(limit = 8): Promise<
    Array<{
      destinationId: string;
      slug: string;
      tourSlug: string | null;
      title: string;
      text: string;
      imageUrl: string | null;
    }>
  > {
    if (!this.prisma.isHealthy()) return [];
    const rows = await this.db.destination.findMany({
      where: { showInHero: true, isActive: true, deletedAt: null },
      orderBy: [{ heroSortOrder: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      take: limit,
      include: {
        tours: {
          where: { status: "PUBLISHED", deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: {
            slug: true,
            shortDescription: true,
            images: { where: { isCover: true }, orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
            departures: {
              where: { status: { in: ["OPEN", "ALMOST_FULL"] }, startDate: { gte: new Date() } },
              orderBy: { startDate: "asc" },
              select: { startDate: true },
            },
          },
        },
      },
    });
    // первый тур для слайда: со скидкой на ближайший актуальный заезд, затем — остальные опубликованные
    return rows.map((d) => {
      const withUpcoming = d.tours.filter((t) => t.departures.length > 0);
      const ordered = [...withUpcoming].sort(
        (a, b) => a.departures[0].startDate.getTime() - b.departures[0].startDate.getTime(),
      );
      const firstTour = ordered[0] ?? d.tours[0];
      const fallbackImg = firstTour?.images[0]?.url ?? null;
      return {
        destinationId: d.id,
        slug: d.slug,
        tourSlug: firstTour?.slug ?? null,
        title: d.heroSlideTitle ?? d.name,
        text: d.heroSlideText ?? firstTour?.shortDescription ?? d.description ?? "",
        imageUrl: d.heroSlideImageUrl ?? d.coverImageUrl ?? fallbackImg,
      };
    });
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
    const exists = await this.db.destination.findUnique({ where: { id }, select: { id: true } });
    if (!exists)
      throw new NotFoundException({ code: "DESTINATION_NOT_FOUND", message: "Направление не найдено" });
    return this.db.destination.update({ where: { id }, data: dto });
  }

  /** Деактивация вместо физического удаления — туры могут ссылаться (§11). */
  async deactivate(id: string) {
    const exists = await this.db.destination.findUnique({ where: { id }, select: { id: true } });
    if (!exists)
      throw new NotFoundException({ code: "DESTINATION_NOT_FOUND", message: "Направление не найдено" });
    return this.db.destination.update({ where: { id }, data: { isActive: false } });
  }

  /** Настройки hero-слайда для админки (эффективные значения + тур клика). */
  async heroSettings(id: string) {
    const d = await this.db.destination.findUnique({
      where: { id },
      include: {
        tours: {
          where: { status: "PUBLISHED", deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: {
            slug: true,
            shortDescription: true,
            images: { where: { isCover: true }, orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
            departures: {
              where: { status: { in: ["OPEN", "ALMOST_FULL"] }, startDate: { gte: new Date() } },
              orderBy: { startDate: "asc" },
              select: { startDate: true },
            },
          },
        },
      },
    });
    if (!d || d.deletedAt)
      throw new NotFoundException({ code: "DESTINATION_NOT_FOUND", message: "Направление не найдено" });
    const withUpcoming = d.tours.filter((t) => t.departures.length > 0);
    const ordered = [...withUpcoming].sort(
      (a, b) => a.departures[0].startDate.getTime() - b.departures[0].startDate.getTime(),
    );
    const firstTour = ordered[0] ?? d.tours[0];
    return {
      title: d.heroSlideTitle ?? d.name,
      text: d.heroSlideText ?? firstTour?.shortDescription ?? d.description ?? "",
      imageUrl: d.heroSlideImageUrl ?? d.coverImageUrl ?? firstTour?.images[0]?.url ?? null,
      showInHero: d.showInHero,
      heroSortOrder: d.heroSortOrder,
      tourSlug: firstTour?.slug ?? null,
    };
  }

  async updateHeroSettings(
    id: string,
    dto: Partial<{ title: string | null; text: string | null; imageUrl: string | null; showInHero: boolean; heroSortOrder: number }>,
  ) {
    const exists = await this.db.destination.findUnique({ where: { id }, select: { id: true } });
    if (!exists)
      throw new NotFoundException({ code: "DESTINATION_NOT_FOUND", message: "Направление не найдено" });
    const data: Record<string, unknown> = {};
    if ("title" in dto) data.heroSlideTitle = dto.title ?? null;
    if ("text" in dto) data.heroSlideText = dto.text ?? null;
    if ("imageUrl" in dto) data.heroSlideImageUrl = dto.imageUrl ?? null;
    if (typeof dto.showInHero === "boolean") data.showInHero = dto.showInHero;
    if (typeof dto.heroSortOrder === "number") data.heroSortOrder = dto.heroSortOrder;
    const d = await this.db.destination.update({ where: { id }, data });
    return { id: d.id, updatedAt: d.updatedAt };
  }
}

class HeroSettingsDto {
  @IsString() @IsOptional() @MaxLength(200) title?: string | null;
  @IsString() @IsOptional() @MaxLength(500) text?: string | null;
  @IsString() @IsOptional() @MaxLength(500) imageUrl?: string | null;
  @IsBoolean() @IsOptional() showInHero?: boolean;
  @IsInt() @IsOptional() heroSortOrder?: number;
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
  @Get("hero")
  @ApiOperation({ summary: "Слайды hero-карусели главной (публично)" })
  async hero() {
    return { success: true, data: await this.svc.heroSlides() };
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

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.TOUR_WRITE)
  @ApiOperation({ summary: "Деактивировать направление (§11, tour:write)" })
  async deactivate(@Param("id") id: string) {
    const d = await this.svc.deactivate(id);
    return { success: true, data: { id: d.id, isActive: d.isActive } };
  }

  @Get(":id/hero")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.TOUR_WRITE)
  @ApiOperation({ summary: "Настройки hero-слайда направления (админка)" })
  async heroSettings(@Param("id") id: string) {
    return { success: true, data: await this.svc.heroSettings(id) };
  }

  @Patch(":id/hero")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.TOUR_WRITE)
  @ApiOperation({ summary: "Изменить hero-слайд: фото/описание/порядок/вкл-выкл (админка)" })
  async updateHeroSettings(@Param("id") id: string, @Body() dto: HeroSettingsDto) {
    const r = await this.svc.updateHeroSettings(id, dto);
    return { success: true, data: r };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [DestinationsController],
  providers: [DestinationsService],
  exports: [DestinationsService],
})
export class DestinationsModule {}
