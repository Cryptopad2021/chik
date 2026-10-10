-- Phase 12 (ТЗ §71–73): аналитика событий + атрибуция источников

-- 1. Новое значение enum: заявка из Telegram-бота отличается от клика с сайта на TG
ALTER TYPE "BookingSource" ADD VALUE IF NOT EXISTS 'TG_BOT';

-- 2. События продуктовой аналитики (без ПДн, §72)
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tourId" TEXT,
    "departureId" TEXT,
    "bookingId" TEXT,
    "sessionId" TEXT,
    "source" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "path" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");
CREATE INDEX "AnalyticsEvent_tourId_createdAt_idx" ON "AnalyticsEvent"("tourId", "createdAt");
CREATE INDEX "AnalyticsEvent_utmSource_createdAt_idx" ON "AnalyticsEvent"("utmSource", "createdAt");
