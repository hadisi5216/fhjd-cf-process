import { PrismaService } from '../prisma/prisma.service';
import { ProductDrawingsService } from './product-drawings.service';
import { ProductExportService } from './product-export.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const product = {
    id: 7,
    productName: '测试产品',
    productModel: 'TEST-001',
    manufacturingProcess: null,
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
      {} as ProductExportService,
    );
  });

  it('updates the display-only manufacturing process as trimmed text', async () => {
    await service.update(7, {
      manufacturingProcess: '  下料\n打磨\n检验  ',
    });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { manufacturingProcess: '下料\n打磨\n检验' },
      include: { currentProcess: true },
    });
  });

  it('clears the manufacturing process without changing actual process fields', async () => {
    await service.update(7, { manufacturingProcess: '   ' });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { manufacturingProcess: null },
      include: { currentProcess: true },
    });
  });
});
