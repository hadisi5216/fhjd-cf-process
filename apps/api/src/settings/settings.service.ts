import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SCREEN_PREVIEW_DATA_KEY = 'screenPreviewDataEnabled';

export type SystemSettings = {
  screenPreviewDataEnabled: boolean;
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<SystemSettings> {
    const previewSetting = await this.prisma.systemSetting.findUnique({
      where: { key: SCREEN_PREVIEW_DATA_KEY },
    });

    return {
      screenPreviewDataEnabled: previewSetting?.value !== 'false',
    };
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<SystemSettings> {
    if (typeof dto.screenPreviewDataEnabled === 'boolean') {
      await this.prisma.systemSetting.upsert({
        where: { key: SCREEN_PREVIEW_DATA_KEY },
        update: { value: String(dto.screenPreviewDataEnabled) },
        create: {
          key: SCREEN_PREVIEW_DATA_KEY,
          value: String(dto.screenPreviewDataEnabled),
        },
      });
    }

    return this.getSettings();
  }
}
