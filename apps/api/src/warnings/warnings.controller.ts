import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthRequest } from '../auth/jwt-auth.guard';
import { HandleWarningDto } from './dto/handle-warning.dto';
import { WarningsService } from './warnings.service';

@UseGuards(JwtAuthGuard)
@Controller('warnings')
export class WarningsController {
  constructor(private readonly warningsService: WarningsService) {}

  @Get()
  list() {
    return this.warningsService.list();
  }

  @Post(':id/handle')
  handle(@Param('id') id: string, @Body() dto: HandleWarningDto, @Req() request: AuthRequest) {
    return this.warningsService.handle(Number(id), dto, request.user!.sub);
  }
}
