import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsSchedulerService } from './notifications-scheduler.service';
import { EmailService } from './email.service';
import { TelegramModule } from '../telegram/telegram.module';

@Global()
@Module({
  imports: [TelegramModule],
  providers: [NotificationsService, NotificationsSchedulerService, EmailService],
  controllers: [NotificationsController],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
