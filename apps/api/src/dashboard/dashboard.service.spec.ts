import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the current server time with the dashboard summary', async () => {
    jest.useFakeTimers().setSystemTime(
      new Date('2026-07-29T05:30:45.000Z'),
    );

    const prisma = {
      product: {
        count: jest
          .fn()
          .mockResolvedValueOnce(12)
          .mockResolvedValueOnce(8)
          .mockResolvedValueOnce(4),
      },
      warning: {
        count: jest.fn().mockResolvedValue(2),
      },
      processStep: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new DashboardService(
      prisma as unknown as PrismaService,
    );

    await expect(service.summary()).resolves.toEqual({
      serverTime: '2026-07-29T05:30:45.000Z',
      total: 12,
      inProgress: 8,
      finished: 4,
      overdue: 2,
      byProcess: [],
    });
  });
});
