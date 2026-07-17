import { BadRequestException, Body, Controller, Delete, Get, Ip, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateScannerDto } from './dto/create-scanner.dto';
import { ScanDto } from './dto/scan.dto';
import { UpdateScannerDto } from './dto/update-scanner.dto';
import { ScannersService } from './scanners.service';

@Controller('scanners')
export class ScannersController {
  constructor(private readonly scannersService: ScannersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list() {
    return this.scannersService.list();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateScannerDto) {
    return this.scannersService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateScannerDto) {
    return this.scannersService.update(Number(id), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.scannersService.remove(Number(id));
  }

  @Post('scan')
  scan(@Body() body: ScanDto | string | Record<string, unknown>, @Query() query: ScanQuery, @Ip() ip: string) {
    return this.scannersService.recordScan({ ...normalizeScanBody(body), ...normalizeScanQuery(query) }, ip);
  }
}

type ScanQuery = Record<string, string | string[] | undefined>;

function normalizeScanBody(body: ScanDto | string | Record<string, unknown>): ScanDto {
  if (typeof body === 'string') {
    return { content: body.trim() };
  }

  if (body && typeof body === 'object' && !('content' in body) && !('productModel' in body)) {
    const entries = Object.entries(body);
    if (entries.length === 1 && (entries[0][1] === '' || entries[0][1] === undefined)) {
      return { content: entries[0][0].trim() };
    }
  }

  if (!body || typeof body !== 'object') {
    throw new BadRequestException('扫码内容不能为空');
  }

  return body as ScanDto;
}

function normalizeScanQuery(query: ScanQuery): Partial<ScanDto> {
  const scannerAlias = firstQueryValue(query.scannerCode ?? query.code ?? query.name ?? query.scanner);
  const content = firstQueryValue(query.content ?? query.productModel);

  return {
    ...(scannerAlias ? { scannerCode: scannerAlias, scannerName: scannerAlias } : {}),
    ...(content ? { content } : {}),
  };
}

function firstQueryValue(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = raw?.trim();
  return normalized || undefined;
}
