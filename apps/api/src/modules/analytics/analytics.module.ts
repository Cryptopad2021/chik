import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsService } from './analytics.service';
import { AnalyticsAdminController, AnalyticsPublicController } from './analytics.controller';

@Module({
  imports: [AuthModule],
  providers: [AnalyticsService],
  controllers: [AnalyticsPublicController, AnalyticsAdminController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
