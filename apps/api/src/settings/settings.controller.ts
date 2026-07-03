import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  publicSettings() {
    return this.settingsService.getSettings();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  settings() {
    return this.settingsService.getSettings();
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }
}
