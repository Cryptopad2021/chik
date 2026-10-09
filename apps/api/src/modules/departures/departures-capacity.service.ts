import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, DepartureStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/app-exception';
import { AuditService } from '../audit/audit.service';

/** Статусы заявок, которые «держат» места на выезде. */
export const OCCUPYING_BOOKING_STATUSES: Prisma.BookingWhereInput['status'] = {
  notIn: ['CANCELLED', 'REFUNDED'],
};

const AUTO_STATUS_STATUSES: DepartureStatus[] = ['OPEN', 'ALMOST_FULL', 'FULL'];

@Injectable()
export class DeparturesCapacityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    if (!this.prisma.isHealthy()) throw AppException.databaseUnavailable();
    return this.prisma;
  }

  /**
   * Атомарный пересчёт bookedSeats по активным броням (ТЗ §12) + авто-статус
   * ALMOST_FULL/FULL (порог: осталось <= 15% мест). Строка выезда блокируется
   * SELECT ... FOR UPDATE (§54), поэтому параллельные пересчёты сериализуются.
   * CANCELLED/COMPLETED не трогаем — продажи закрыты вручную.
   */
  async recalculate(departureId: string, actor?: { userId?: string; reason?: string }) {
    return this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string; total_seats: number; status: string }>>`
          SELECT id, "totalSeats" AS total_seats, status
          FROM "Departure" WHERE id = ${departureId}::uuid FOR UPDATE`;
        const dep = rows[0];
        if (!dep) throw new AppException('DEPARTURE_NOT_FOUND', 'Выезд не найден', 404);

        const agg = await tx.booking.aggregate({
          where: { departureId, status: OCCUPYING_BOOKING_STATUSES },
          _sum: { adults: true, children10to14: true, childrenUnder10: true },
        });
        const booked =
          (agg._sum.adults ?? 0) + (agg._sum.children10to14 ?? 0) + (agg._sum.childrenUnder10 ?? 0);

        const remaining = Math.max(dep.total_seats - booked, 0);
        let status = dep.status as DepartureStatus;
        if (AUTO_STATUS_STATUSES.includes(status)) {
          status =
            remaining <= 0
              ? 'FULL'
              : remaining <= Math.ceil(dep.total_seats * 0.15)
                ? 'ALMOST_FULL'
                : 'OPEN';
        }

        const updated = await tx.departure.update({
          where: { id: departureId },
          data: { bookedSeats: booked, status },
        });

        await this.audit.log({
          userId: actor?.userId ?? undefined,
          action: 'DEPARTURE_SEATS_RECALCULATED',
          entity: 'Departure',
          entityId: departureId,
          metadata: {
            bookedSeats: booked,
            totalSeats: dep.total_seats,
            status,
            reason: actor?.reason ?? 'manual',
          },
        });

        return {
          id: updated.id,
          bookedSeats: booked,
          totalSeats: dep.total_seats,
          availableSeats: remaining,
          status,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 10000 },
    );
  }

  /**
   * Защита от удаления/закрытия выезда с активными бронями (ТЗ §6.3):
   * без confirm=true бросает ConflictException со списком активных заявок.
   */
  async assertNoActiveBookings(departureId: string, allowOverride: boolean) {
    const activeCount = await this.db.booking.count({
      where: { departureId, status: OCCUPYING_BOOKING_STATUSES },
    });
    if (activeCount === 0) return { blocked: false, activeCount: 0 };
    if (!allowOverride) {
      throw new ConflictException({
        code: 'DEPARTURE_HAS_ACTIVE_BOOKINGS',
        message: `У выезда ${activeCount} активных заявок. Удаление/отмена возможны только после их обработки (или с confirm=true и записью в аудит)`,
        details: { activeCount },
      });
    }
    return { blocked: true, activeCount };
  }
}
