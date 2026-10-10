import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ToursModule } from "./modules/tours/tours.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { DestinationsModule } from "./modules/destinations/destinations.module";
import { DepartureCitiesModule } from "./modules/departure-cities/departure-cities.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { DeparturesModule } from "./modules/departures/departures.module";
import { UsersModule } from "./modules/users/users.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { ContactRequestsModule } from "./modules/contact-requests/contact-requests.module";
import { FaqModule } from "./modules/faq/faq.module";
import { MediaModule } from "./modules/media/media.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { TelegramModule } from "./modules/telegram/telegram.module";
import { AdminStatsModule } from "./modules/admin-stats/admin-stats.module";
import { HealthController } from "./modules/health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    ToursModule,
    BookingsModule,
    DestinationsModule,
    DepartureCitiesModule,
    ReviewsModule,
    DeparturesModule,
    UsersModule,
    SettingsModule,
    FaqModule,
    MediaModule,
    ContactRequestsModule,
    NotificationsModule,
    TelegramModule,
    AdminStatsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
