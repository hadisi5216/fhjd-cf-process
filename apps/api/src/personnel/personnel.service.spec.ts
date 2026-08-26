import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PersonnelService } from './personnel.service';

describe('PersonnelService', () => {
  let prisma: {
    personnel: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    processStep: { findUnique: jest.Mock };
    productProcessOwner: { findFirst: jest.Mock };
  };
  let service: PersonnelService;

  beforeEach(() => {
    prisma = {
      personnel: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      processStep: { findUnique: jest.fn() },
      productProcessOwner: { findFirst: jest.fn() },
    };
    service = new PersonnelService(prisma as unknown as PrismaService);
  });

  it('trims the personnel name and assigns the selected process', async () => {
    prisma.processStep.findUnique.mockResolvedValue({ id: 2 });
    prisma.personnel.create.mockResolvedValue({ id: 5 });

    await service.create({
      name: '  张工  ',
      processStepId: 2,
      enabled: true,
    });

    expect(prisma.personnel.create).toHaveBeenCalledWith({
      data: { name: '张工', processStepId: 2, enabled: true },
      include: { processStep: true },
    });
  });

  it('prevents deleting personnel assigned to a product', async () => {
    prisma.personnel.findUnique.mockResolvedValue({
      id: 5,
      processStepId: 2,
    });
    prisma.productProcessOwner.findFirst.mockResolvedValue({ id: 9 });

    await expect(service.remove(5)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.personnel.delete).not.toHaveBeenCalled();
  });

  it('prevents changing the process after personnel is assigned', async () => {
    prisma.personnel.findUnique.mockResolvedValue({
      id: 5,
      processStepId: 2,
    });
    prisma.processStep.findUnique.mockResolvedValue({ id: 3 });
    prisma.productProcessOwner.findFirst.mockResolvedValue({ id: 9 });

    await expect(
      service.update(5, { processStepId: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.personnel.update).not.toHaveBeenCalled();
  });
});
