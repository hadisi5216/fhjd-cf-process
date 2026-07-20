import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateScannerDto } from './dto/create-scanner.dto';
import { ScanDto } from './dto/scan.dto';
import { UpdateScannerDto } from './dto/update-scanner.dto';

@Injectable()
export class ScannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  list() {
    return this.prisma.scanner.findMany({
      include: {
        processStep: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  create(dto: CreateScannerDto) {
    return this.prisma.scanner.create({
      data: {
        code: dto.code,
        name: dto.name,
        ipAddress: dto.ipAddress,
        processStepId: dto.processStepId,
        location: dto.location,
        enabled: dto.enabled ?? true,
      },
      include: { processStep: true },
    });
  }

  async update(id: number, dto: UpdateScannerDto) {
    await this.ensureExists(id);
    return this.prisma.scanner.update({
      where: { id },
      data: dto,
      include: { processStep: true },
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    await this.prisma.scanner.delete({ where: { id } });
    return { success: true };
  }

  async recordScan(dto: ScanDto, sourceIp: string) {
    const normalizedSourceIp = normalizeIp(sourceIp);
    const scannerCode = normalizeText(dto.scannerCode);
    const scannerName = normalizeText(dto.scannerName);
    const scannerOptions = buildScannerMatchOptions(scannerCode, scannerName, normalizedSourceIp);

    const scanner = await this.prisma.scanner.findFirst({
      where: {
        enabled: true,
        OR: scannerOptions,
      },
      include: {
        processStep: true,
      },
    });

    if (!scanner) {
      throw new NotFoundException('未找到已启用的扫码枪配置');
    }

    const scanContent = normalizeText(dto.content ?? dto.productModel);
    if (!scanContent) {
      throw new BadRequestException('扫码内容不能为空');
    }

    const scannedAt = dto.scanTime ? new Date(dto.scanTime) : new Date();
    if (Number.isNaN(scannedAt.getTime())) {
      throw new BadRequestException('扫码时间格式不正确');
    }

    await this.prisma.scanner.update({
      where: { id: scanner.id },
      data: { lastSeenAt: scannedAt },
    });

    const product = await this.findProductByScanContent(scanContent);

    if (!product) {
      throw new NotFoundException('未找到匹配扫码内容的产品');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize every scan for one product so different process guns cannot race each other.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${product.id}, 0)::text`;

      const currentProduct = await tx.product.findUnique({ where: { id: product.id } });
      if (!currentProduct) {
        throw new NotFoundException('产品不存在');
      }
      const isDuplicate = currentProduct.currentProcessId === scanner.processStepId;

      const flowRecord = await tx.flowRecord.create({
        data: {
          productId: product.id,
          scanContent,
          scannerId: scanner.id,
          processStepId: scanner.processStepId,
          isDuplicate,
          scannedAt,
        },
      });

      const updatedProduct = isDuplicate
        ? currentProduct
        : await tx.product.update({
            where: { id: product.id },
            data: {
              currentProcessId: scanner.processStepId,
              currentEnteredAt: scannedAt,
              status: scanner.processStep.name === '完工' ? 'FINISHED' : 'IN_PROGRESS',
            },
          });

      return {
        flowRecord,
        updatedProduct,
        isDuplicate,
        enteredAt: isDuplicate ? (currentProduct.currentEnteredAt ?? scannedAt) : scannedAt,
      };
    });

    if (!result.isDuplicate) {
      this.realtimeService.notifyDashboardUpdate({
        reason: 'SCAN',
        productId: product.id,
        processStepId: scanner.processStepId,
      });
    }

    return {
      success: true,
      duplicated: result.isDuplicate,
      message: result.isDuplicate ? '重复扫码已记录' : '流转成功',
      data: {
        productId: result.updatedProduct.id,
        content: scanContent,
        productName: product.productName,
        processName: scanner.processStep.name,
        enteredAt: result.enteredAt,
        scannedAt: result.flowRecord.scannedAt,
      },
    };
  }

  private async ensureExists(id: number) {
    const scanner = await this.prisma.scanner.findUnique({ where: { id } });
    if (!scanner) {
      throw new NotFoundException('扫码枪不存在');
    }
  }

  private async findProductByScanContent(scanContent: string) {
    const exactProduct = await this.prisma.product.findFirst({
      where: {
        productModel: scanContent,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (exactProduct) {
      return exactProduct;
    }

    const candidates = await this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return candidates.find((candidate) => candidate.productModel.trim() === scanContent) ?? null;
  }
}

function normalizeIp(value?: string) {
  if (!value) return undefined;
  const normalized = value.trim().replace(/^::ffff:/, '');
  return normalized === '::1' ? '127.0.0.1' : normalized;
}

function normalizeText(value?: string) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function buildScannerMatchOptions(scannerCode?: string, scannerName?: string, fallbackIp?: string) {
  const aliasOptions = [
    scannerCode ? { code: scannerCode } : undefined,
    scannerCode ? { name: scannerCode } : undefined,
    scannerName && scannerName !== scannerCode ? { name: scannerName } : undefined,
  ].filter(Boolean) as Array<{ code?: string; name?: string }>;

  if (aliasOptions.length) {
    return aliasOptions;
  }

  return fallbackIp ? [{ ipAddress: fallbackIp }] : [{ id: -1 }];
}
