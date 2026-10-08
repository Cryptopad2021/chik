import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ToursService } from "./tours.service";
import { CreateTourDto, UpdateTourDto, ListToursQuery } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PERMISSIONS } from "../../common/constants";
import {
  CurrentUser,
  AuthUser,
} from "../../common/decorators/current-user.decorator";
import { AuditService } from "../audit/audit.service";

@ApiTags("tours")
@Controller("api/tours")
export class ToursController {
  constructor(
    private readonly tours: ToursService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Каталог туров (публичный; фильтры: destination, city, dates, price, duration, sort)",
  })
  async list(@Query() q: ListToursQuery) {
    return { success: true, data: await this.tours.list(q) };
  }

  @Get(":slug")
  @ApiOperation({
    summary: "Тур по slug с программой, галереей, выездами и отзывами",
  })
  async bySlug(@Param("slug") slug: string) {
    return { success: true, data: await this.tours.bySlug(slug) };
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.TOUR_WRITE)
  @ApiOperation({ summary: "Создать тур (tour:write)" })
  async create(@Body() dto: CreateTourDto, @CurrentUser() user: AuthUser) {
    const tour = await this.tours.create(dto);
    await this.audit.log({
      userId: user.id,
      action: "TOUR_CREATED",
      entity: "Tour",
      entityId: tour.id,
      metadata: { title: tour.title },
    });
    return { success: true, data: tour };
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.TOUR_WRITE)
  @ApiOperation({ summary: "Обновить тур (tour:write)" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateTourDto,
    @CurrentUser() user: AuthUser,
  ) {
    const tour = await this.tours.update(id, dto);
    await this.audit.log({
      userId: user.id,
      action: "TOUR_UPDATED",
      entity: "Tour",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return { success: true, data: tour };
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.TOUR_WRITE)
  @ApiOperation({ summary: "Архивировать тур — soft delete (tour:write)" })
  async archive(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const tour = await this.tours.archive(id);
    await this.audit.log({
      userId: user.id,
      action: "TOUR_ARCHIVED",
      entity: "Tour",
      entityId: id,
    });
    return { success: true, data: { id: tour.id, archived: true } };
  }
}
