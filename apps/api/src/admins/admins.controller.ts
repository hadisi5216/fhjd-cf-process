import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthRequest } from '../auth/jwt-auth.guard';
import { AdminsService } from './admins.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get('profile')
  profile(@Req() request: AuthRequest) {
    return this.adminsService.profile(request.user!.sub);
  }

  @Put('password')
  changePassword(@Req() request: AuthRequest, @Body() dto: ChangePasswordDto) {
    return this.adminsService.changePassword(request.user!.sub, dto);
  }
}
