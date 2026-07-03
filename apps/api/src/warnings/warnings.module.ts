import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WarningSchedulerService } from './warning-scheduler.service';
import { WarningsController } from './warnings.controller';
import { WarningsService } from './warnings.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WarningsController],
  providers: [WarningsService, WarningSchedulerService],
})
export class WarningsModule {}
