import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('public')
  @ApiOperation({ summary: 'Публичные настройки: контакты, hero, Telegram-CTA (без секретов)' })
  public() {
    return this.settings.publicSettings();
  }
}
