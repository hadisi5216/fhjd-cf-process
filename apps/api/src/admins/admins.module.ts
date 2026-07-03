import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminsController],
  providers: [AdminsService],
})
export class AdminsModule {}
