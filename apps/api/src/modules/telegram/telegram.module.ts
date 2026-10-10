import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramPublicationService } from './telegram-publication.service';
import { TelegramController } from './telegram.controller';

/**
 * Telegram-модуль (Phase 10): сервис Bot API, бот-wizard бронирования (§32),
 * публикации в канал (§33–34), webhook (§47). Audit/Notifications — глобальные модули.
 */
@Module({
  imports: [AuthModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramBotService, TelegramPublicationService],
  exports: [TelegramService, TelegramPublicationService],
})
export class TelegramModule {}
