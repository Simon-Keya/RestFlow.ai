// apps/api/src/modules/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      shop_id: (user as { shop_id?: string }).shop_id ?? '1',
    };

    const shopId =
      (user as { shop_id?: string }).shop_id?.trim() ||
      payload.shop_id ||
      '1';
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        shopId,
        shop_id: shopId,
      },
    };
  }

  async register(data: RegisterDto) {
    const existing = await this.usersService.findByEmail(data.email);
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        password: hashedPassword,
        name: data.name.trim(),
        role: 'KITCHEN' /* server-enforced default; ignore client role */,
      },
    });

    // Return token without re-validating password
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      shop_id: (user as { shop_id?: string }).shop_id ?? '1',
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}