import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { BookingsService } from "./bookings.service";
import { CreateBookingDto, ChangeBookingStatusDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PERMISSIONS } from "../../common/constants";
import {
  CurrentUser,
  AuthUser,
} from "../../common/decorators/current-user.decorator";
import { AuditService } from "../audit/audit.service";

@ApiTags("bookings")
@Controller("api/bookings")
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      "Создать заявку (публичный; атомарное списание мест, защита от overselling)",
  })
  async create(@Body() dto: CreateBookingDto) {
    const { booking, replayed } = await this.bookings.create(dto);
    return {
      success: true,
      data: {
        bookingNumber: booking.bookingNumber,
        id: booking.id,
        status: booking.status,
        totalAmount: booking.totalAmount,
        currency: booking.currency,
        replayed,
      },
    };
  }

  @Get("by-number/:bookingNumber")
  @ApiOperation({
    summary: "Публичная страница подтверждения заявки по номеру",
  })
  async byNumber(@Param("bookingNumber") bookingNumber: string) {
    return {
      success: true,
      data: await this.bookings.byNumberPublic(bookingNumber),
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({
    summary:
      "Список заявок (booking:read): поиск, фильтры статуса/тура, пагинация",
  })
  async list(
    @Query("status") status?: string,
    @Query("tourId") tourId?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("perPage") perPage?: string,
  ) {
    return {
      success: true,
      data: await this.bookings.list({
        status,
        tourId,
        search,
        page: Number(page) || undefined,
        perPage: Number(perPage) || undefined,
      }),
    };
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({ summary: "Заявка целиком (booking:read)" })
  async byId(@Param("id") id: string) {
    return { success: true, data: await this.bookings.byId(id) };
  }

  @Patch(":id/status")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.BOOKING_MANAGE)
  @ApiOperation({
    summary:
      "Смена статуса (booking:manage) с machine-readable переходом и освобождением мест при отмене",
  })
  async changeStatus(
    @Param("id") id: string,
    @Body() dto: ChangeBookingStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.bookings.changeStatus(
      id,
      dto.status,
      user.id,
      dto.note,
    );
    await this.audit.log({
      userId: user.id,
      action: "BOOKING_STATUS_CHANGED",
      entity: "Booking",
      entityId: id,
      metadata: { from: result.previous, to: result.current },
    });
    return { success: true, data: result };
  }

  @Patch(":id/manager")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.BOOKING_MANAGE)
  @ApiOperation({ summary: "Назначить менеджера (booking:manage)" })
  async assignManager(
    @Param("id") id: string,
    @Body("managerId") managerId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const r = await this.bookings.assignManager(id, managerId);
    await this.audit.log({
      userId: user.id,
      action: "BOOKING_ASSIGNED",
      entity: "Booking",
      entityId: id,
      metadata: { managerId },
    });
    return { success: true, data: r };
  }

  @Patch(":id/comment")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({ summary: "Добавить комментарий менеджера" })
  async addComment(
    @Param("id") id: string,
    @Body("text") text: string,
    @CurrentUser() user: AuthUser,
  ) {
    return {
      success: true,
      data: await this.bookings.addComment(id, text, user.id),
    };
  }
}
