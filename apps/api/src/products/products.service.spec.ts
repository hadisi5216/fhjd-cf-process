import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ProductDrawingsService } from './product-drawings.service';
import { ProductExportService } from './product-export.service';
import { ProductProcessAttachmentsService } from './product-process-attachments.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const expectedProductRelations = {
    currentProcess: true,
    processOwners: {
      include: { processStep: true, personnel: true },
      orderBy: { processStep: { sortOrder: 'asc' } },
    },
  };
  const product = {
    id: 7,
    productName: '测试产品',
    productModel: 'TEST-001',
    trackingCode: 'TRACK-001',
    status: 'IN_PROGRESS',
  };

  let prisma: {
    product: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    flowRecord: { count: jest.Mock };
    warning: { count: jest.Mock; updateMany: jest.Mock };
    processStep: { findMany: jest.Mock };
    personnel: { findMany: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let productDrawingsService: {
    getStoredNames: jest.Mock;
    removeStoredFiles: jest.Mock;
  };
  let productProcessAttachmentsService: {
    getStoredNames: jest.Mock;
    removeStoredFiles: jest.Mock;
  };
  let service: ProductsService;
  let realtimeService: { notifyDashboardUpdate: jest.Mock };

  beforeEach(() => {
    prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(product),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(product),
        create: jest.fn().mockResolvedValue(product),
        delete: jest.fn().mockResolvedValue(product),
      },
      flowRecord: { count: jest.fn().mockResolvedValue(0) },
      warning: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      processStep: { findMany: jest.fn() },
      personnel: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest
        .fn()
        .mockImplementation((callback) => callback(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    productDrawingsService = {
      getStoredNames: jest.fn().mockResolvedValue([]),
      removeStoredFiles: jest.fn().mockResolvedValue(undefined),
    };
    productProcessAttachmentsService = {
      getStoredNames: jest.fn().mockResolvedValue([]),
      removeStoredFiles: jest.fn().mockResolvedValue(undefined),
    };
    realtimeService = { notifyDashboardUpdate: jest.fn() };
    service = new ProductsService(
      prisma as unknown as PrismaService,
      productDrawingsService as unknown as ProductDrawingsService,
      productProcessAttachmentsService as unknown as ProductProcessAttachmentsService,
      {} as ProductExportService,
      realtimeService as unknown as RealtimeService,
    );
  });

  it('normalizes editable product text fields', async () => {
    await service.update(7, {
      productName: '  测试产品  ',
      remark: '  重点件  ',
    });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { productName: '测试产品', remark: '重点件' },
      include: expectedProductRelations,
    });
  });

  it('clears nullable product text fields when empty values are submitted', async () => {
    await service.update(7, {
      serialNo: '  ',
      remark: '',
    });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { serialNo: null, remark: null },
      include: expectedProductRelations,
    });
  });

  it('accepts null values from cleared form fields', async () => {
    await service.update(7, {
      serialNo: null,
      remark: null,
    });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { serialNo: null, remark: null },
      include: expectedProductRelations,
    });
  });

  it('fills the tracking code when an older product is edited', async () => {
    prisma.product.findUnique.mockResolvedValue({
      ...product,
      trackingCode: null,
    });

    await service.update(7, { remark: '更新备注' });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        trackingCode: product.productModel,
        remark: '更新备注',
      },
      include: expectedProductRelations,
    });
  });

  it('creates product process owner assignments', async () => {
    prisma.processStep.findMany.mockResolvedValue([{ id: 1, name: '打磨' }]);
    prisma.personnel.findMany.mockResolvedValue([
      {
        id: 8,
        name: '张工',
        processStepId: 1,
        enabled: true,
      },
    ]);

    await service.create({
      productName: '测试产品',
      productModel: 'TEST-001',
      trackingCode: 'TRACK-002',
      processOwners: [{ processStepId: 1, personnelId: 8 }],
    });

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        rowNo: undefined,
        productName: '测试产品',
        productModel: 'TEST-001',
        trackingCode: 'TRACK-002',
        serialNo: undefined,
        remark: undefined,
        processOwners: {
          create: [{ processStepId: 1, personnelId: 8 }],
        },
      },
      include: expectedProductRelations,
    });
  });

  it('defaults the tracking code to the product model', async () => {
    prisma.processStep.findMany.mockResolvedValue([]);

    await service.create({
      productName: '测试产品',
      productModel: 'MODEL-001',
      processOwners: [],
    });

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ trackingCode: 'MODEL-001' }),
      include: expectedProductRelations,
    });
  });

  it('rejects duplicate tracking codes', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 8 });
    prisma.processStep.findMany.mockResolvedValue([]);

    await expect(
      service.create({
        productName: '测试产品',
        productModel: 'MODEL-001',
        trackingCode: 'TRACK-001',
        processOwners: [],
      }),
    ).rejects.toThrow('流转编号已存在，请使用唯一编号');
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('rejects personnel from another process', async () => {
    prisma.processStep.findMany.mockResolvedValue([{ id: 1, name: '打磨' }]);
    prisma.personnel.findMany.mockResolvedValue([
      {
        id: 8,
        name: '李工',
        processStepId: 2,
        enabled: true,
      },
    ]);

    await expect(
      service.create({
        productName: '测试产品',
        productModel: 'TEST-001',
        processOwners: [{ processStepId: 1, personnelId: 8 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('deletes products without flow or warning records', async () => {
    await expect(service.remove(7)).resolves.toEqual({ success: true });

    expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it('rejects deletion when the product has flow records', async () => {
    prisma.flowRecord.count.mockResolvedValue(1);

    await expect(service.remove(7)).rejects.toThrow(
      '该产品已有流转记录或预警记录，不能删除',
    );
    expect(prisma.product.delete).not.toHaveBeenCalled();
    expect(productDrawingsService.getStoredNames).not.toHaveBeenCalled();
  });

  it('rejects deletion when the product has warning records', async () => {
    prisma.warning.count.mockResolvedValue(1);

    await expect(service.remove(7)).rejects.toThrow(
      '该产品已有流转记录或预警记录，不能删除',
    );
    expect(prisma.product.delete).not.toHaveBeenCalled();
  });

  it('voids a product and handles its open warnings', async () => {
    prisma.product.update.mockResolvedValue({ ...product, status: 'VOIDED' });

    await service.voidProduct(7, { reason: '  录入错误  ' });

    expect(prisma.warning.updateMany).toHaveBeenCalledWith({
      where: { productId: 7, status: 'OPEN' },
      data: {
        status: 'HANDLED',
        handledAt: expect.any(Date),
        handledNote: '产品作废：录入错误',
      },
    });
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        status: 'VOIDED',
        voidedAt: expect.any(Date),
        voidReason: '录入错误',
      },
      include: expectedProductRelations,
    });
    expect(realtimeService.notifyDashboardUpdate).toHaveBeenCalledWith({
      reason: 'PRODUCT',
      productId: 7,
    });
  });

  it('rejects repeated void operations', async () => {
    prisma.product.findUnique.mockResolvedValue({
      ...product,
      status: 'VOIDED',
    });

    await expect(
      service.voidProduct(7, { reason: '重复操作' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
