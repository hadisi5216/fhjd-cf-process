import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WarningSchedulerService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scanOverdueProducts() {
    const products = await this.prisma.product.findMany({
      where: {
        status: 'IN_PROGRESS',
        currentEnteredAt: { not: null },
        currentProcessId: { not: null },
      },
      include: { currentProcess: true },
    });

    const now = Date.now();

    for (const item of products) {
      if (!item.currentEnteredAt || !item.currentProcess || item.currentProcess.timeoutHours <= 0) {
        continue;
      }

      const elapsedHours = (now - item.currentEnteredAt.getTime()) / 3_600_000;
      if (elapsedHours < item.currentProcess.timeoutHours) {
        continue;
      }

      const existing = await this.prisma.warning.findFirst({
        where: {
          productId: item.id,
          processStepId: item.currentProcess.id,
          status: 'OPEN',
        },
      });

      if (existing) {
        continue;
      }

      await this.prisma.warning.create({
        data: {
          productId: item.id,
          processStepId: item.currentProcess.id,
          enteredAt: item.currentEnteredAt,
          timeoutHours: item.currentProcess.timeoutHours,
          status: 'OPEN',
        },
      });
    }
  }
}
