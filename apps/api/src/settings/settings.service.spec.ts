import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let prisma: {
    systemSetting: {
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let realtimeService: {
    notifyDashboardUpdate: jest.Mock;
  };
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      systemSetting: {
        findMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    realtimeService = {
      notifyDashboardUpdate: jest.fn(),
    };
    service = new SettingsService(
      prisma as unknown as PrismaService,
      realtimeService as unknown as RealtimeService,
    );
  });

  it('uses the standard list font size when no valid setting exists', async () => {
    prisma.systemSetting.findMany.mockResolvedValue([
      { key: 'screenListFontSize', value: 'UNKNOWN' },
    ]);

    await expect(service.getSettings()).resolves.toEqual({
      screenPreviewDataEnabled: true,
      screenListFontSize: 'STANDARD',
    });
  });

  it('saves the list font size and notifies the public screen', async () => {
    prisma.systemSetting.findMany.mockResolvedValue([
      { key: 'screenPreviewDataEnabled', value: 'false' },
      { key: 'screenListFontSize', value: 'LARGE' },
    ]);

    await expect(
      service.updateSettings({ screenListFontSize: 'LARGE' }),
    ).resolves.toEqual({
      screenPreviewDataEnabled: false,
      screenListFontSize: 'LARGE',
    });
    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'screenListFontSize' },
      update: { value: 'LARGE' },
      create: {
        key: 'screenListFontSize',
        value: 'LARGE',
      },
    });
    expect(
      realtimeService.notifyDashboardUpdate,
    ).toHaveBeenCalledWith({
      reason: 'SETTINGS',
    });
  });
});
