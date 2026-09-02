import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ChangeProductProcessDto } from './dto/change-product-process.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { VoidProductDto } from './dto/void-product.dto';
import { ProductDrawingsService } from './product-drawings.service';
import { ProductExportService } from './product-export.service';
import { ProductProcessAttachmentsService } from './product-process-attachments.service';
import { ProductProcessOwnerDto } from './dto/product-process-owner.dto';

const productRelations = {
  currentProcess: true,
  processOwners: {
    include: {
      processStep: true,
      personnel: true,
    },
    orderBy: { processStep: { sortOrder: 'asc' as const } },
  },
} as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productDrawingsService: ProductDrawingsService,
    private readonly productProcessAttachmentsService: ProductProcessAttachmentsService,
    private readonly productExportService: ProductExportService,
    private readonly realtimeService: RealtimeService,
  ) {}

  list(keyword?: string, status?: string, processId?: string) {
    return this.prisma.product.findMany({
      where: buildProductFilter(keyword, status, processId),
      include: productRelations,
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });
  }

  async export(keyword?: string, status?: string, processId?: string) {
    const products = await this.prisma.product.findMany({
      where: buildProductFilter(keyword, status, processId),
      include: {
        currentProcess: true,
        processAttachments: {
          select: { originalName: true },
          orderBy: { createdAt: 'asc' },
        },
        processOwners: {
          include: {
            processStep: true,
            personnel: true,
          },
          orderBy: { processStep: { sortOrder: 'asc' } },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    return this.productExportService.createWorkbook(products);
  }

  async create(dto: CreateProductDto) {
    const processOwners = await this.validateProcessOwners(dto.processOwners);
    const trackingCode = normalizeRequiredText(
      dto.trackingCode ?? dto.productModel,
      '流转编号不能为空',
    );
    await this.ensureTrackingCodeAvailable(trackingCode);
    return this.prisma.product.create({
      data: {
        rowNo: dto.rowNo,
        productName: dto.productName.trim(),
        productModel: dto.productModel.trim(),
        trackingCode,
        serialNo: normalizeOptionalText(dto.serialNo),
        remark: normalizeOptionalText(dto.remark),
        processOwners: {
          create: processOwners,
        },
      },
      include: productRelations,
    });
  }

  async detail(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productRelations,
    });
    if (!product) {
      throw new NotFoundException('产品不存在');
    }
    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    const product = await this.detail(id);
    const { processOwners, ...productData } = dto;
    const normalizedProductData = normalizeUpdateProductData(productData);
    const trackingCode =
      normalizedProductData.trackingCode ??
      (!product.trackingCode
        ? (normalizedProductData.productModel ?? product.productModel)
        : undefined);
    if (trackingCode !== undefined) {
      await this.ensureTrackingCodeAvailable(trackingCode, id);
      normalizedProductData.trackingCode = trackingCode;
    }
    if (processOwners !== undefined) {
      const validatedOwners = await this.validateProcessOwners(processOwners);
      return this.prisma.$transaction(async (tx) => {
        await tx.productProcessOwner.deleteMany({
          where: { productId: id },
        });
        if (validatedOwners.length > 0) {
          await tx.productProcessOwner.createMany({
            data: validatedOwners.map((owner) => ({
              productId: id,
              ...owner,
            })),
          });
        }
        return tx.product.update({
          where: { id },
          data: normalizedProductData,
          include: productRelations,
        });
      });
    }
    return this.prisma.product.update({
      where: { id },
      data: normalizedProductData,
      include: productRelations,
    });
  }

  async changeProcess(id: number, dto: ChangeProductProcessDto) {
    const product = await this.detail(id);
    if (product.status === 'VOIDED') {
      throw new ConflictException('产品已作废，不能调整工序');
    }

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
          scanContent: product.trackingCode ?? product.productModel,
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
        include: productRelations,
      });
    });
  }

  async voidProduct(id: number, dto: VoidProductDto) {
    const product = await this.detail(id);
    if (product.status === 'VOIDED') {
      throw new ConflictException('产品已经作废');
    }
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException('请输入作废原因');
    }
    const voidedAt = new Date();
    const updatedProduct = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${id}, 0)::text`;
      const currentProduct = await tx.product.findUnique({ where: { id } });
      if (!currentProduct) {
        throw new NotFoundException('产品不存在');
      }
      if (currentProduct.status === 'VOIDED') {
        throw new ConflictException('产品已经作废');
      }
      await tx.warning.updateMany({
        where: { productId: id, status: 'OPEN' },
        data: {
          status: 'HANDLED',
          handledAt: voidedAt,
          handledNote: `产品作废：${reason}`,
        },
      });
      return tx.product.update({
        where: { id },
        data: {
          status: 'VOIDED',
          voidedAt,
          voidReason: reason,
        },
        include: productRelations,
      });
    });
    this.realtimeService.notifyDashboardUpdate({
      reason: 'PRODUCT',
      productId: product.id,
    });
    return updatedProduct;
  }

  async remove(id: number) {
    await this.detail(id);
    const [flowRecordCount, warningCount] = await Promise.all([
      this.prisma.flowRecord.count({ where: { productId: id } }),
      this.prisma.warning.count({ where: { productId: id } }),
    ]);
    if (flowRecordCount > 0 || warningCount > 0) {
      throw new ConflictException('该产品已有流转记录或预警记录，不能删除');
    }
    const [drawingStoredNames, processAttachmentStoredNames] =
      await Promise.all([
        this.productDrawingsService.getStoredNames(id),
        this.productProcessAttachmentsService.getStoredNames(id),
      ]);
    await this.prisma.product.delete({ where: { id } });
    this.realtimeService.notifyDashboardUpdate({
      reason: 'PRODUCT',
      productId: id,
    });
    await Promise.all([
      this.productDrawingsService
        .removeStoredFiles(drawingStoredNames)
        .catch(() => undefined),
      this.productProcessAttachmentsService
        .removeStoredFiles(processAttachmentStoredNames)
        .catch(() => undefined),
    ]);
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

  private async validateProcessOwners(assignments: ProductProcessOwnerDto[]) {
    const requiredProcesses = await this.prisma.processStep.findMany({
      where: {
        enabled: true,
        name: { not: '完工' },
      },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });
    const assignmentMap = new Map<number, number>();
    for (const assignment of assignments) {
      if (assignmentMap.has(assignment.processStepId)) {
        throw new BadRequestException('同一工序只能指定一名负责人');
      }
      assignmentMap.set(assignment.processStepId, assignment.personnelId);
    }

    for (const processStep of requiredProcesses) {
      if (!assignmentMap.has(processStep.id)) {
        throw new BadRequestException(`请指定${processStep.name}工序负责人`);
      }
    }
    if (assignmentMap.size !== requiredProcesses.length) {
      throw new BadRequestException('负责人分配包含无效或未启用的工序');
    }

    const personnel = await this.prisma.personnel.findMany({
      where: { id: { in: [...assignmentMap.values()] } },
      select: {
        id: true,
        name: true,
        processStepId: true,
        enabled: true,
      },
    });
    const personnelMap = new Map(personnel.map((item) => [item.id, item]));
    return requiredProcesses.map((processStep) => {
      const personnelId = assignmentMap.get(processStep.id)!;
      const owner = personnelMap.get(personnelId);
      if (!owner || !owner.enabled) {
        throw new BadRequestException(
          `${processStep.name}工序负责人不存在或已停用`,
        );
      }
      if (owner.processStepId !== processStep.id) {
        throw new BadRequestException(
          `${owner.name}不属于${processStep.name}工序`,
        );
      }
      return {
        processStepId: processStep.id,
        personnelId: owner.id,
      };
    });
  }

  private async ensureTrackingCodeAvailable(
    trackingCode: string,
    excludedProductId?: number,
  ) {
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        OR: [
          { trackingCode },
          { trackingCode: null, productModel: trackingCode },
        ],
        ...(excludedProductId ? { id: { not: excludedProductId } } : {}),
      },
      select: { id: true },
    });
    if (existingProduct) {
      throw new ConflictException('流转编号已存在，请使用唯一编号');
    }
  }
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeNullableText(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeRequiredText(value: string, message: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new BadRequestException(message);
  }
  return normalized;
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
              trackingCode: {
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

function normalizeUpdateProductData(
  dto: Omit<UpdateProductDto, 'processOwners'>,
) {
  const {
    productName,
    productModel,
    trackingCode,
    serialNo,
    remark,
    ...unchangedFields
  } = dto;

  return {
    ...unchangedFields,
    ...(productName !== undefined ? { productName: productName.trim() } : {}),
    ...(productModel !== undefined
      ? { productModel: productModel.trim() }
      : {}),
    ...(trackingCode !== undefined
      ? {
          trackingCode: normalizeRequiredText(trackingCode, '流转编号不能为空'),
        }
      : {}),
    ...(serialNo !== undefined
      ? { serialNo: normalizeNullableText(serialNo) }
      : {}),
    ...(remark !== undefined ? { remark: normalizeNullableText(remark) } : {}),
  };
}
