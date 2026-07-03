import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProcessesController } from './processes.controller';
import { ProcessesService } from './processes.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ProcessesController],
  providers: [ProcessesService],
})
export class ProcessesModule {}
