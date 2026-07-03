import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScannerDto } from './dto/create-scanner.dto';
import { ScanDto } from './dto/scan.dto';
import { UpdateScannerDto } from './dto/update-scanner.dto';

@Injectable()
export class ScannersService {
  constructor(private readonly prisma: PrismaService) {}

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
    const sourceOptions = [
      dto.scannerCode ? { code: dto.scannerCode } : undefined,
      { ipAddress: sourceIp },
    ].filter(Boolean) as Array<{ code?: string; ipAddress?: string }>;

    const scanner = await this.prisma.scanner.findFirst({
      where: {
        enabled: true,
        OR: sourceOptions,
      },
      include: {
        processStep: true,
      },
    });

    if (!scanner) {
      throw new NotFoundException('未找到已启用的扫码枪配置');
    }

    const scanContent = dto.content ?? dto.productModel;
    if (!scanContent) {
      throw new BadRequestException('扫码内容不能为空');
    }

    const product = await this.prisma.product.findFirst({
      where: {
        productModel: scanContent,
        status: { not: 'FINISHED' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!product) {
      throw new NotFoundException('未找到匹配扫码内容的产品');
    }

    const scannedAt = dto.scanTime ? new Date(dto.scanTime) : new Date();
    if (Number.isNaN(scannedAt.getTime())) {
      throw new BadRequestException('扫码时间格式不正确');
    }

    const recentDuplicate = await this.prisma.flowRecord.findFirst({
      where: {
        productId: product.id,
        processStepId: scanner.processStepId,
        scannedAt: {
          gte: new Date(scannedAt.getTime() - 60_000),
        },
      },
    });

    if (recentDuplicate) {
      return {
        success: true,
        duplicated: true,
        message: '重复扫码已忽略',
        data: {
          content: scanContent,
          productName: product.productName,
          processName: scanner.processStep.name,
          enteredAt: recentDuplicate.scannedAt,
        },
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.scanner.update({
        where: { id: scanner.id },
        data: { lastSeenAt: scannedAt },
      });

      const flowRecord = await tx.flowRecord.create({
        data: {
          productId: product.id,
          scanContent,
          scannerId: scanner.id,
          processStepId: scanner.processStepId,
          scannedAt,
        },
      });

      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          currentProcessId: scanner.processStepId,
          currentEnteredAt: scannedAt,
          status: scanner.processStep.name === '完工' ? 'FINISHED' : 'IN_PROGRESS',
        },
      });

      return { flowRecord, updatedProduct };
    });

    return {
      success: true,
      message: '流转成功',
      data: {
        productId: result.updatedProduct.id,
        content: scanContent,
        productName: product.productName,
        processName: scanner.processStep.name,
        enteredAt: result.flowRecord.scannedAt,
      },
    };
  }

  private async ensureExists(id: number) {
    const scanner = await this.prisma.scanner.findUnique({ where: { id } });
    if (!scanner) {
      throw new NotFoundException('扫码枪不存在');
    }
  }
}
