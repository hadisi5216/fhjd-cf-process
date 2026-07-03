import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProcessDto } from './dto/create-process.dto';
import { UpdateProcessDto } from './dto/update-process.dto';

@Injectable()
export class ProcessesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.processStep.findMany({
      include: {
        _count: {
          select: {
            scanners: true,
            products: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  create(dto: CreateProcessDto) {
    return this.prisma.processStep.create({
      data: {
        name: dto.name,
        sortOrder: dto.sortOrder,
        timeoutHours: dto.timeoutHours ?? 72,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async update(id: number, dto: UpdateProcessDto) {
    await this.ensureExists(id);
    return this.prisma.processStep.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    await this.prisma.processStep.delete({ where: { id } });
    return { success: true };
  }

  private async ensureExists(id: number) {
    const process = await this.prisma.processStep.findUnique({ where: { id } });
    if (!process) {
      throw new NotFoundException('工序不存在');
    }
  }
}
