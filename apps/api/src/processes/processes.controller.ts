import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProcessDto } from './dto/create-process.dto';
import { UpdateProcessDto } from './dto/update-process.dto';
import { ProcessesService } from './processes.service';

@UseGuards(JwtAuthGuard)
@Controller('processes')
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  @Get()
  list() {
    return this.processesService.list();
  }

  @Post()
  create(@Body() dto: CreateProcessDto) {
    return this.processesService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProcessDto) {
    return this.processesService.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.processesService.remove(Number(id));
  }
}
