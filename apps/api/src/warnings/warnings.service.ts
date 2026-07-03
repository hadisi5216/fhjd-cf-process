import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HandleWarningDto } from './dto/handle-warning.dto';

@Injectable()
export class WarningsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.warning.findMany({
      include: {
        product: true,
        processStep: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async handle(id: number, dto: HandleWarningDto, operatorUserId: number) {
    const warning = await this.prisma.warning.findUnique({ where: { id } });
    if (!warning) {
      throw new NotFoundException('预警不存在');
    }

    return this.prisma.warning.update({
      where: { id },
      data: {
        status: 'HANDLED',
        handledAt: new Date(),
        handledNote: dto.handledNote,
        operatorUserId,
      },
      include: {
        product: true,
        processStep: true,
      },
    });
  }
}
