import { PrismaService } from '../prisma/prisma.service';
import { ProductDrawingsService } from './product-drawings.service';
import { ProductExportService } from './product-export.service';
import { ProductProcessAttachmentsService } from './product-process-attachments.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const product = {
    id: 7,
    productName: '测试产品',
    productModel: 'TEST-001',
  };

  let prisma: {
    product: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: ProductsService;

  beforeEach(() => {
    prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(product),
        update: jest.fn().mockResolvedValue(product),
      },
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
      include: { currentProcess: true },
    });
  });
});
