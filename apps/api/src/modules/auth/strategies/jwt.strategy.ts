// apps/api/src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    const secret =
      configService.get<string>('jwt.secret') ||
      configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('jwt.secret / JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    shop_id?: string;
  }) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        shop_id: true,
        is_active: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.is_active === false) {
      throw new UnauthorizedException('User is inactive');
    }

    const shopId =
      (typeof user.shop_id === 'string' && user.shop_id.trim()
        ? user.shop_id.trim()
        : null) ||
      (typeof payload.shop_id === 'string' && payload.shop_id.trim()
        ? payload.shop_id.trim()
        : null) ||
      '1';

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      shopId,
      shop_id: shopId,
    };
  }
}
