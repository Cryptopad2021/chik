-- Phase 10.6: ingest канала — TelegramPost как источник контента (ТЗ §33)
ALTER TABLE "TelegramPost" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'PUBLICATION';
ALTER TABLE "TelegramPost" ADD COLUMN "channelChatId" TEXT;
ALTER TABLE "TelegramPost" ADD COLUMN "channelUsername" TEXT;

CREATE INDEX "TelegramPost_telegramMessageId_idx" ON "TelegramPost"("telegramMessageId");
CREATE INDEX "TelegramPost_source_createdAt_idx" ON "TelegramPost"("source", "createdAt");
