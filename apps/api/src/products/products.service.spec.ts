import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  };

  let prisma: {
    product: {
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    processStep: { findMany: jest.Mock };
    personnel: { findMany: jest.Mock };
  };
  let service: ProductsService;

  beforeEach(() => {
    prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(product),
        update: jest.fn().mockResolvedValue(product),
        create: jest.fn().mockResolvedValue(product),
      },
      processStep: { findMany: jest.fn() },
      personnel: { findMany: jest.fn() },
    };
    service = new ProductsService(
      prisma as unknown as PrismaService,
      {} as ProductDrawingsService,
      {} as ProductProcessAttachmentsService,
      {} as ProductExportService,
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

  it('restores the default unit when the submitted unit is empty', async () => {
    await service.update(7, {
      unit: '  ',
    });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { unit: '件' },
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
      processOwners: [{ processStepId: 1, personnelId: 8 }],
    });

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        rowNo: undefined,
        productName: '测试产品',
        productModel: 'TEST-001',
        serialNo: undefined,
        quantity: 1,
        unit: '件',
        remark: undefined,
        processOwners: {
          create: [{ processStepId: 1, personnelId: 8 }],
        },
      },
      include: expectedProductRelations,
    });
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
});
