import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductDrawingsService } from './product-drawings.service';
import { ProductExportService } from './product-export.service';
import { ProductProcessAttachmentsService } from './product-process-attachments.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ProductDrawingsService,
    ProductProcessAttachmentsService,
    ProductExportService,
  ],
})
export class ProductsModule {}
