import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeProductProcessDto } from './dto/change-product-process.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductDrawingsService } from './product-drawings.service';
import { ProductExportService } from './product-export.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productDrawingsService: ProductDrawingsService,
    private readonly productExportService: ProductExportService,
  ) {}

  list(keyword?: string, status?: string, processId?: string) {
    return this.prisma.product.findMany({
      where: buildProductFilter(keyword, status, processId),
      include: {
        currentProcess: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });
  }

  async export(keyword?: string, status?: string, processId?: string) {
    const products = await this.prisma.product.findMany({
      where: buildProductFilter(keyword, status, processId),
      include: { currentProcess: true },
      orderBy: [{ createdAt: 'desc' }],
    });
    return this.productExportService.createWorkbook(products);
  }

  create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        rowNo: dto.rowNo,
        productName: dto.productName.trim(),
        productModel: dto.productModel.trim(),
        serialNo: normalizeOptionalText(dto.serialNo),
        quantity: dto.quantity ?? 1,
        unit: normalizeOptionalText(dto.unit) ?? '件',
        remark: normalizeOptionalText(dto.remark),
        manufacturingProcess: normalizeOptionalText(dto.manufacturingProcess),
      },
      include: { currentProcess: true },
    });
  }

  async detail(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { currentProcess: true },
    });
    if (!product) {
      throw new NotFoundException('产品不存在');
    }
    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.detail(id);
    return this.prisma.product.update({
      where: { id },
      data: normalizeUpdateProductData(dto),
      include: { currentProcess: true },
    });
  }

  async changeProcess(id: number, dto: ChangeProductProcessDto) {
    const product = await this.detail(id);

    const processStep = await this.prisma.processStep.findUnique({
      where: { id: dto.processStepId },
    });
    if (!processStep) {
      throw new NotFoundException('工序不存在');
    }

    const enteredAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.flowRecord.create({
        data: {
          productId: product.id,
          scanContent: product.productModel,
          source: 'MANUAL',
          note: '管理员手动调整工序',
          processStepId: processStep.id,
          scannedAt: enteredAt,
        },
      });

      return tx.product.update({
        where: { id },
        data: {
          currentProcessId: processStep.id,
          currentEnteredAt: enteredAt,
          status: processStep.name === '完工' ? 'FINISHED' : 'IN_PROGRESS',
        },
        include: { currentProcess: true },
      });
    });
  }

  async remove(id: number) {
    await this.detail(id);
    const storedNames = await this.productDrawingsService.getStoredNames(id);
    await this.prisma.product.delete({ where: { id } });
    await this.productDrawingsService
      .removeStoredFiles(storedNames)
      .catch(() => undefined);
    return { success: true };
  }

  flows(id: number) {
    return this.prisma.flowRecord.findMany({
      where: { productId: id },
      include: {
        scanner: true,
        processStep: true,
        operator: true,
      },
      orderBy: { scannedAt: 'asc' },
    });
  }
}

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function buildProductFilter(
  keyword?: string,
  status?: string,
  processId?: string,
) {
  const parsedProcessId = processId ? Number(processId) : undefined;
  return {
    ...(keyword
      ? {
          OR: [
            {
              productName: {
                contains: keyword,
                mode: 'insensitive' as const,
              },
            },
            {
              productModel: {
                contains: keyword,
                mode: 'insensitive' as const,
              },
            },
            {
              serialNo: { contains: keyword, mode: 'insensitive' as const },
            },
          ],
        }
      : {}),
    ...(status ? { status: status as never } : {}),
    ...(Number.isFinite(parsedProcessId)
      ? { currentProcessId: parsedProcessId }
      : {}),
  };
}

function normalizeUpdateProductData(dto: UpdateProductDto) {
  return {
    ...dto,
    ...(dto.productName !== undefined
      ? { productName: dto.productName.trim() }
      : {}),
    ...(dto.productModel !== undefined
      ? { productModel: dto.productModel.trim() }
      : {}),
    ...(dto.serialNo !== undefined
      ? { serialNo: normalizeOptionalText(dto.serialNo) }
      : {}),
    ...(dto.unit !== undefined
      ? { unit: normalizeOptionalText(dto.unit) }
      : {}),
    ...(dto.remark !== undefined
      ? { remark: normalizeOptionalText(dto.remark) }
      : {}),
    ...(dto.manufacturingProcess !== undefined
      ? {
          manufacturingProcess: normalizeNullableText(dto.manufacturingProcess),
        }
      : {}),
  };
}

function normalizeNullableText(value: string) {
  return value.trim() || null;
}
