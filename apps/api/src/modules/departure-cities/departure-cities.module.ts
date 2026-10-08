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
import { IsNumber, IsOptional, IsString, MaxLength } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify, ensureUniqueSlug } from "../../common/slug";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PERMISSIONS } from "../../common/constants";

class UpsertCityDto {
  @IsString() @MaxLength(200) name!: string;
  @IsString() @IsOptional() @MaxLength(500) address?: string;
  @IsNumber() @IsOptional() lat?: number;
  @IsNumber() @IsOptional() lng?: number;
  @IsString() @IsOptional() @MaxLength(2000) meetingInstructions?: string;
}

@Injectable()
export class DepartureCitiesService {
  constructor(private readonly prisma: PrismaService) {}
  async list(activeOnly = true) {
    if (!this.prisma.isHealthy()) return [];
    return this.prisma.departureCity.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { sortOrder: "asc" },
    });
  }
  async create(dto: UpsertCityDto) {
    const base = slugify(dto.name);
    const slug = await ensureUniqueSlug(base, async (s) =>
      !!(await this.prisma.departureCity.findFirst({
        where: { slug: s },
        select: { id: true },
      })),
    );
    return this.prisma.departureCity.create({
      data: {
        ...dto,
        slug,
        address: dto.address ?? undefined,
        meetingInstructions: dto.meetingInstructions ?? undefined,
        coordinates:
          dto.lat != null && dto.lng != null ? { lat: dto.lat, lng: dto.lng } : undefined,
      },
    });
  }
  async update(id: string, dto: UpsertCityDto) {
    const c = await this.prisma.departureCity.findUnique({ where: { id } });
    if (!c)
      throw new NotFoundException({
        code: "CITY_NOT_FOUND",
        message: "Город не найден",
      });
    return this.prisma.departureCity.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address ?? undefined,
        meetingInstructions: dto.meetingInstructions ?? undefined,
        coordinates:
          dto.lat != null && dto.lng != null
            ? { lat: dto.lat, lng: dto.lng }
            : undefined,
      },
    });
  }
}

@ApiTags("departure-cities")
@Controller("api/departure-cities")
export class DepartureCitiesController {
  constructor(
    private readonly svc: DepartureCitiesService,
    private readonly jwt: JwtAuthGuard,
  ) {}
  @Get()
  @ApiOperation({ summary: "Города отправления" })
  async list() {
    return { success: true, data: await this.svc.list(true) };
  }
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.DEPARTURE_WRITE)
  async create(@Body() dto: UpsertCityDto) {
    return { success: true, data: await this.svc.create(dto) };
  }
  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.DEPARTURE_WRITE)
  async update(@Param("id") id: string, @Body() dto: UpsertCityDto) {
    return { success: true, data: await this.svc.update(id, dto) };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [DepartureCitiesController],
  providers: [DepartureCitiesService],
  exports: [DepartureCitiesService],
})
export class DepartureCitiesModule {}
