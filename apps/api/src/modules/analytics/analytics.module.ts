import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsAdminController, AnalyticsPublicController } from './analytics.controller';

@Module({
  providers: [AnalyticsService],
  controllers: [AnalyticsPublicController, AnalyticsAdminController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
