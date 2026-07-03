import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('管理员不存在');
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      enabled: user.enabled,
      createdAt: user.createdAt,
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('管理员不存在');
    }

    const oldPasswordOk = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!oldPasswordOk) {
      throw new BadRequestException('原密码不正确');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) },
    });

    return { success: true };
  }
}
