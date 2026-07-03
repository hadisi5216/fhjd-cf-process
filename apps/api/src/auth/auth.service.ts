import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (!user || !user.enabled) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, username: user.username },
      { secret: process.env.JWT_SECRET ?? 'change_me_to_a_long_random_secret', expiresIn: '8h' },
    );

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    };
  }
}
