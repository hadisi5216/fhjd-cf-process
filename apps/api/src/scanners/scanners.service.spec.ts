import { ScannersService } from './scanners.service';

describe('ScannersService', () => {
  const scanner = {
    id: 1,
    code: 'DM',
    name: '打磨扫码枪',
    processStepId: 10,
    processStep: { id: 10, name: '打磨' },
  };
  const product = {
    id: 20,
    productName: '12号导管管体',
    productModel: 'J/CLL9-12A-101S1.1',
    status: 'IN_PROGRESS',
    currentProcessId: 11,
    currentEnteredAt: new Date('2026-07-15T01:00:00.000Z'),
  };

  function createFixture(firstEntry: { id: number; scannedAt: Date } | null) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      flowRecord: {
        findFirst: jest.fn().mockResolvedValue(firstEntry),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 30, ...data })),
      },
      product: {
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...product, ...data })),
      },
    };
    const prisma = {
      scanner: {
        findFirst: jest.fn().mockResolvedValue(scanner),
        update: jest.fn().mockResolvedValue(scanner),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue(product),
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };

    return {
      service: new ScannersService(prisma as never),
      prisma,
      tx,
    };
  }

  it('uses the first scan as the process entry time', async () => {
    const { service, tx } = createFixture(null);

    const result = await service.recordScan(
      {
        scannerCode: 'DM',
        content: product.productModel,
        scanTime: '2026-07-15T02:00:00.000Z',
      },
      '192.168.188.11',
    );

    expect(result.duplicated).toBe(false);
    expect(tx.flowRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isDuplicate: false }),
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: product.id },
      data: expect.objectContaining({
        currentProcessId: scanner.processStepId,
        currentEnteredAt: new Date('2026-07-15T02:00:00.000Z'),
      }),
    });
  });

  it('records later scans as duplicates without changing product progress', async () => {
    const firstScannedAt = new Date('2026-07-15T02:00:00.000Z');
    const { service, tx } = createFixture({ id: 29, scannedAt: firstScannedAt });

    const result = await service.recordScan(
      {
        scannerCode: 'DM',
        content: product.productModel,
        scanTime: '2026-07-15T03:00:00.000Z',
      },
      '192.168.188.11',
    );

    expect(result.duplicated).toBe(true);
    expect(result.message).toBe('重复扫码已记录');
    expect(result.data.enteredAt).toEqual(firstScannedAt);
    expect(result.data.scannedAt).toEqual(new Date('2026-07-15T03:00:00.000Z'));
    expect(tx.flowRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isDuplicate: true }),
    });
    expect(tx.product.update).not.toHaveBeenCalled();
  });
});
