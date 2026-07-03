import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [total, inProgress, finished, overdue, processSteps] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.product.count({ where: { status: 'FINISHED' } }),
      this.prisma.warning.count({ where: { status: 'OPEN' } }),
      this.prisma.processStep.findMany({
        where: {
          name: { not: '完工' },
        },
        orderBy: { sortOrder: 'asc' },
        include: {
          products: {
            where: {
              status: { in: ['IN_PROGRESS', 'OVERDUE'] },
              currentEnteredAt: { not: null },
            },
            orderBy: [{ currentEnteredAt: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              productName: true,
              productModel: true,
              serialNo: true,
              status: true,
              currentEnteredAt: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      inProgress,
      finished,
      overdue,
      byProcess: processSteps.map((step) => ({
        id: step.id,
        name: step.name,
        count: step.products.length,
        products: step.products,
      })),
    };
  }
}
