import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ScannersController } from './scanners.controller';
import { ScannersService } from './scanners.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ScannersController],
  providers: [ScannersService],
})
export class ScannersModule {}
