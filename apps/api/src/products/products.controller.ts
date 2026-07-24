import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ChangeProductProcessDto } from './dto/change-product-process.dto';
import { ProductDrawingsService } from './product-drawings.service';
import { ProductProcessAttachmentsService } from './product-process-attachments.service';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productDrawingsService: ProductDrawingsService,
    private readonly productProcessAttachmentsService: ProductProcessAttachmentsService,
  ) {}

  @Get()
  list(
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('processId') processId?: string,
  ) {
    return this.productsService.list(keyword, status, processId);
  }

  @Get('export')
  async export(
    @Query('keyword') keyword: string | undefined,
    @Query('status') status: string | undefined,
    @Query('processId') processId: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.productsService.export(keyword, status, processId);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="products-${formatExportTimestamp()}.xlsx"`,
    );
    return new StreamableFile(file);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.productsService.detail(Number(id));
  }

  @Put(':id/process')
  changeProcess(@Param('id') id: string, @Body() dto: ChangeProductProcessDto) {
    return this.productsService.changeProcess(Number(id), dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(Number(id));
  }

  @Get(':id/flows')
  flows(@Param('id') id: string) {
    return this.productsService.flows(Number(id));
  }

  @Get(':id/drawings')
  drawings(@Param('id') id: string) {
    return this.productDrawingsService.list(Number(id));
  }

  @Post(':id/drawings')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  uploadDrawing(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.productDrawingsService.create(Number(id), file);
  }

  @Get(':id/drawings/:drawingId/file')
  @Header('Cache-Control', 'private, max-age=3600')
  async drawingFile(
    @Param('id') id: string,
    @Param('drawingId') drawingId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.productDrawingsService.open(
      Number(id),
      Number(drawingId),
    );
    const disposition =
      result.drawing.mimeType === 'application/pdf' ? 'inline' : 'attachment';
    response.setHeader('Content-Type', result.drawing.mimeType);
    response.setHeader('Content-Length', result.drawing.size);
    response.setHeader(
      'Content-Disposition',
      `${disposition}; filename="drawing${extname(result.drawing.originalName)}"; filename*=UTF-8''${encodeURIComponent(result.drawing.originalName)}`,
    );
    return result.file;
  }

  @Delete(':id/drawings/:drawingId')
  removeDrawing(
    @Param('id') id: string,
    @Param('drawingId') drawingId: string,
  ) {
    return this.productDrawingsService.remove(Number(id), Number(drawingId));
  }

  @Get(':id/process-attachments')
  processAttachments(@Param('id') id: string) {
    return this.productProcessAttachmentsService.list(Number(id));
  }

  @Post(':id/process-attachments')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  uploadProcessAttachment(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.productProcessAttachmentsService.create(Number(id), file);
  }

  @Get(':id/process-attachments/:attachmentId/preview')
  previewProcessAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.productProcessAttachmentsService.preview(
      Number(id),
      Number(attachmentId),
    );
  }

  @Get(':id/process-attachments/:attachmentId/file')
  @Header('Cache-Control', 'private, max-age=3600')
  async processAttachmentFile(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.productProcessAttachmentsService.open(
      Number(id),
      Number(attachmentId),
    );
    response.setHeader('Content-Type', result.attachment.mimeType);
    response.setHeader('Content-Length', result.attachment.size);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="process-attachment${extname(result.attachment.originalName)}"; filename*=UTF-8''${encodeURIComponent(result.attachment.originalName)}`,
    );
    return result.file;
  }

  @Delete(':id/process-attachments/:attachmentId')
  removeProcessAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.productProcessAttachmentsService.remove(
      Number(id),
      Number(attachmentId),
    );
  }
}

function formatExportTimestamp() {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(/\D/g, '');
}
