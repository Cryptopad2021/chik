import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Белый список полей SiteSettings, которые можно менять через админку. */
const EDITABLE_FIELDS = [
  'companyName', 'phone', 'email', 'telegramUrl', 'telegramBotUrl', 'address',
  'socialLinks', 'logoUrl', 'faviconUrl', 'seoDefaultTitle', 'seoDefaultDescription',
  'heroTitle', 'heroDescription', 'advantages', 'howItWorks', 'footerText',
  'bookingEnabled', 'autoConfirmEnabled', 'notifyNewBookingTelegram',
  'managerTelegramChatIds', 'telegramChannelId', 'telegramPostTemplate', 'featureFlags',
] as const;

/** Публичные настройки сайта (ТЗ §56–57, §70): контакты, hero, Telegram-ссылки. */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async adminSettings() {
    if (!this.prisma.isHealthy()) return null;
    return this.prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });
  }

  async update(body: Record<string, unknown>) {
    if (!body || typeof body !== 'object') throw new BadRequestException('Пустое тело запроса');
    const data: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if ((EDITABLE_FIELDS as readonly string[]).includes(key)) data[key] = body[key];
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Нет разрешённых полей для обновления' });
    }
    if (!this.prisma.isHealthy()) throw new BadRequestException('Данные временно недоступны');
    return this.prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });
  }

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
