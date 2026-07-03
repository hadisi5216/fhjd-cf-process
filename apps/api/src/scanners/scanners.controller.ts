import { Body, Controller, Delete, Get, Ip, Param, Post, Put, UseGuards } from '@nestjs/common';
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
  scan(@Body() dto: ScanDto, @Ip() ip: string) {
    return this.scannersService.recordScan(dto, ip);
  }
}
