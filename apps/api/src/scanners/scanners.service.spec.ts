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

  function createFixture(currentProduct = product, scannerRecord = scanner) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      flowRecord: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 30, ...data })),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue(currentProduct),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...currentProduct, ...data })),
      },
    };
    const prisma = {
      scanner: {
        findFirst: jest.fn().mockResolvedValue(scannerRecord),
        update: jest.fn().mockResolvedValue(scannerRecord),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue(currentProduct),
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const realtime = {
      notifyDashboardUpdate: jest.fn(),
    };

    return {
      service: new ScannersService(prisma as never, realtime as never),
      prisma,
      realtime,
      tx,
    };
  }

  it('moves to the scanned process regardless of process order', async () => {
    const { service, realtime, tx } = createFixture();

    const result = await service.recordScan(
      {
        scannerCode: 'DM',
        content: product.productModel,
        scanTime: '2026-07-15T02:00:00.000Z',
      },
      '192.168.1.11',
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
    expect(realtime.notifyDashboardUpdate).toHaveBeenCalledWith({
      reason: 'SCAN',
      productId: product.id,
      processStepId: scanner.processStepId,
    });
  });

  it('records later scans as duplicates without changing product progress', async () => {
    const firstScannedAt = new Date('2026-07-15T02:00:00.000Z');
    const currentProduct = {
      ...product,
      currentProcessId: scanner.processStepId,
      currentEnteredAt: firstScannedAt,
    };
    const { service, realtime, tx } = createFixture(currentProduct);

    const result = await service.recordScan(
      {
        scannerCode: 'DM',
        content: product.productModel,
        scanTime: '2026-07-15T03:00:00.000Z',
      },
      '192.168.1.11',
    );

    expect(result.duplicated).toBe(true);
    expect(result.message).toBe('重复扫码已记录');
    expect(result.data.enteredAt).toEqual(firstScannedAt);
    expect(result.data.scannedAt).toEqual(new Date('2026-07-15T03:00:00.000Z'));
    expect(tx.flowRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isDuplicate: true }),
    });
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(realtime.notifyDashboardUpdate).not.toHaveBeenCalled();
  });

  it('marks the product as finished when it enters the completion process', async () => {
    const completionScanner = {
      ...scanner,
      id: 5,
      code: 'WG',
      name: '完工扫码枪',
      processStepId: 50,
      processStep: { id: 50, name: '完工' },
    };
    const { service, realtime, tx } = createFixture(product, completionScanner);

    await service.recordScan(
      {
        scannerCode: 'WG',
        content: product.productModel,
        scanTime: '2026-07-20T02:00:00.000Z',
      },
      '192.168.1.15',
    );

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: product.id },
      data: expect.objectContaining({
        currentProcessId: completionScanner.processStepId,
        status: 'FINISHED',
      }),
    });
    expect(realtime.notifyDashboardUpdate).toHaveBeenCalledWith({
      reason: 'SCAN',
      productId: product.id,
      processStepId: completionScanner.processStepId,
    });
  });

  it('allows a finished product to re-enter any processing step', async () => {
    const finishedProduct = {
      ...product,
      status: 'FINISHED',
      currentProcessId: 50,
    };
    const { service, realtime, tx } = createFixture(finishedProduct);

    const result = await service.recordScan(
      {
        scannerCode: 'DM',
        content: product.productModel,
        scanTime: '2026-07-20T03:00:00.000Z',
      },
      '192.168.1.11',
    );

    expect(result.duplicated).toBe(false);
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: product.id },
      data: expect.objectContaining({
        currentProcessId: scanner.processStepId,
        status: 'IN_PROGRESS',
      }),
    });
    expect(realtime.notifyDashboardUpdate).toHaveBeenCalled();
  });
});
