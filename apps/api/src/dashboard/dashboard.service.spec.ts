import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the current server time with the dashboard summary', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T05:30:45.000Z'));

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
    const service = new DashboardService(prisma as unknown as PrismaService);

    await expect(service.summary()).resolves.toEqual({
      serverTime: '2026-07-29T05:30:45.000Z',
      total: 12,
      inProgress: 8,
      finished: 4,
      overdue: 2,
      byProcess: [],
    });
  });

  it('returns the owner assigned to the product current process', async () => {
    const prisma = {
      product: {
        count: jest
          .fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0),
      },
      warning: {
        count: jest.fn().mockResolvedValue(0),
      },
      processStep: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 2,
            name: '装配',
            products: [
              {
                id: 10,
                productName: '测试产品',
                productModel: 'TEST-01',
                serialNo: null,
                status: 'IN_PROGRESS',
                currentEnteredAt: new Date('2026-08-26T01:00:00.000Z'),
                processOwners: [
                  {
                    processStepId: 1,
                    personnel: { name: '张三' },
                  },
                  {
                    processStepId: 2,
                    personnel: { name: '李四' },
                  },
                ],
              },
            ],
          },
        ]),
      },
    };
    const service = new DashboardService(prisma as unknown as PrismaService);

    const result = await service.summary();

    expect(result.byProcess[0].products[0]).toMatchObject({
      id: 10,
      ownerName: '李四',
    });
    expect(result.byProcess[0].products[0]).not.toHaveProperty('processOwners');
  });
});
