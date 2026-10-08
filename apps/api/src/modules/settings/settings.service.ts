import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Публичные настройки сайта (ТЗ §56–57, §70): контакты, hero, Telegram-ссылки. */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async publicSettings() {
    if (!this.prisma.isHealthy()) return null;
    const s = await this.prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });
    return {
      companyName: s.companyName,
      phone: s.phone,
      email: s.email,
      telegramUrl: s.telegramUrl,
      telegramBotUrl: s.telegramBotUrl,
      address: s.address,
      socialLinks: s.socialLinks,
      logoUrl: s.logoUrl,
      seoDefaultTitle: s.seoDefaultTitle,
      seoDefaultDescription: s.seoDefaultDescription,
      heroTitle: s.heroTitle,
      heroDescription: s.heroDescription,
      advantages: s.advantages,
      howItWorks: s.howItWorks,
      footerText: s.footerText,
      bookingEnabled: s.bookingEnabled,
    };
  }
}
