import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SCREEN_PREVIEW_DATA_KEY = 'screenPreviewDataEnabled';
const SCREEN_LIST_FONT_SIZE_KEY = 'screenListFontSize';
const SCREEN_LIST_FONT_SIZES = [
  'SMALL',
  'STANDARD',
  'LARGE',
  'EXTRA_LARGE',
] as const;

export type ScreenListFontSize =
  (typeof SCREEN_LIST_FONT_SIZES)[number];

export type SystemSettings = {
  screenPreviewDataEnabled: boolean;
  screenListFontSize: ScreenListFontSize;
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async getSettings(): Promise<SystemSettings> {
    const records = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [SCREEN_PREVIEW_DATA_KEY, SCREEN_LIST_FONT_SIZE_KEY],
        },
      },
    });
    const settings = new Map(
      records.map((record) => [record.key, record.value]),
    );

    return {
      screenPreviewDataEnabled:
        settings.get(SCREEN_PREVIEW_DATA_KEY) !== 'false',
      screenListFontSize: parseScreenListFontSize(
        settings.get(SCREEN_LIST_FONT_SIZE_KEY),
      ),
    };
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<SystemSettings> {
    let changed = false;

    if (typeof dto.screenPreviewDataEnabled === 'boolean') {
      const value = String(dto.screenPreviewDataEnabled);
      await this.prisma.systemSetting.upsert({
        where: { key: SCREEN_PREVIEW_DATA_KEY },
        update: { value },
        create: { key: SCREEN_PREVIEW_DATA_KEY, value },
      });
      changed = true;
    }

    if (dto.screenListFontSize) {
      await this.prisma.systemSetting.upsert({
        where: { key: SCREEN_LIST_FONT_SIZE_KEY },
        update: { value: dto.screenListFontSize },
        create: {
          key: SCREEN_LIST_FONT_SIZE_KEY,
          value: dto.screenListFontSize,
        },
      });
      changed = true;
    }

    if (changed) {
      this.realtimeService.notifyDashboardUpdate({
        reason: 'SETTINGS',
      });
    }

    return this.getSettings();
  }
}

function parseScreenListFontSize(
  value?: string,
): ScreenListFontSize {
  return SCREEN_LIST_FONT_SIZES.includes(
    value as ScreenListFontSize,
  )
    ? (value as ScreenListFontSize)
    : 'STANDARD';
}
