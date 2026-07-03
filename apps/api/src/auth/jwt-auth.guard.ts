import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export type AuthUser = {
  sub: number;
  username: string;
};

export type AuthRequest = Request & {
  user?: AuthUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException('请先登录');
    }

    try {
      request.user = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: process.env.JWT_SECRET ?? 'change_me_to_a_long_random_secret',
      });
      return true;
    } catch {
      throw new UnauthorizedException('登录已失效');
    }
  }
}
