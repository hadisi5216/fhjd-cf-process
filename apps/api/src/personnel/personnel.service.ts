import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonnelDto } from './dto/create-personnel.dto';
import { UpdatePersonnelDto } from './dto/update-personnel.dto';

@Injectable()
export class PersonnelService {
  constructor(private readonly prisma: PrismaService) {}

  list(processStepId?: string, enabled?: string) {
    const parsedProcessStepId = processStepId
      ? Number(processStepId)
      : undefined;
    return this.prisma.personnel.findMany({
      where: {
        ...(Number.isFinite(parsedProcessStepId)
          ? { processStepId: parsedProcessStepId }
          : {}),
        ...(enabled === 'true' || enabled === 'false'
          ? { enabled: enabled === 'true' }
          : {}),
      },
      include: { processStep: true },
      orderBy: [
        { processStep: { sortOrder: 'asc' } },
        { name: 'asc' },
        { id: 'asc' },
      ],
    });
  }

  async create(dto: CreatePersonnelDto) {
    await this.ensureProcessExists(dto.processStepId);
    return this.prisma.personnel.create({
      data: {
        name: normalizeRequiredName(dto.name),
        processStepId: dto.processStepId,
        enabled: dto.enabled ?? true,
      },
      include: { processStep: true },
    });
  }

  async update(id: number, dto: UpdatePersonnelDto) {
    const existing = await this.ensureExists(id);
    if (dto.processStepId !== undefined) {
      await this.ensureProcessExists(dto.processStepId);
      if (dto.processStepId !== existing.processStepId) {
        const assignment = await this.prisma.productProcessOwner.findFirst({
          where: { personnelId: id },
          select: { id: true },
        });
        if (assignment) {
          throw new BadRequestException(
            '该人员已被分配为产品工序负责人，不能变更所属工序',
          );
        }
      }
    }
    return this.prisma.personnel.update({
      where: { id },
      data: {
        ...(dto.name !== undefined
          ? { name: normalizeRequiredName(dto.name) }
          : {}),
        ...(dto.processStepId !== undefined
          ? { processStepId: dto.processStepId }
          : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
      include: { processStep: true },
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    const assignment = await this.prisma.productProcessOwner.findFirst({
      where: { personnelId: id },
      select: { id: true },
    });
    if (assignment) {
      throw new BadRequestException(
        '该人员已被分配为产品工序负责人，请停用该人员',
      );
    }
    await this.prisma.personnel.delete({ where: { id } });
    return { success: true };
  }

  private async ensureExists(id: number) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id },
    });
    if (!personnel) {
      throw new NotFoundException('人员不存在');
    }
    return personnel;
  }

  private async ensureProcessExists(id: number) {
    const processStep = await this.prisma.processStep.findUnique({
      where: { id },
    });
    if (!processStep) {
      throw new BadRequestException('所属工序不存在');
    }
  }
}

function normalizeRequiredName(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new BadRequestException('人员姓名不能为空');
  }
  return normalized;
}
