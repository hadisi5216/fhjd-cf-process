import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ChangeProductProcessDto } from './dto/change-product-process.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query('keyword') keyword?: string, @Query('status') status?: string, @Query('processId') processId?: string) {
    return this.productsService.list(keyword, status, processId);
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
}
