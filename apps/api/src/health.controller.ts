// apps/api/src/health.controller.ts
import { Controller, Get, Head, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @Head()
  @HttpCode(200)
  root() {
    return { status: 'ok', service: 'restflow-api' };
  }

  @Public()
  @Get('health')
  @Head('health')
  @HttpCode(200)
  health() {
    return { status: 'ok' };
  }

  @Public()
  @Get('health/live')
  @Head('health/live')
  @HttpCode(200)
  live() {
    return { status: 'ok', check: 'live' };
  }

  @Public()
  @Get('health/ready')
  @Head('health/ready')
  async ready(@Res() res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({ status: 'ok', check: 'ready', db: true });
    } catch {
      return res.status(503).json({ status: 'unavailable', check: 'ready', db: false });
    }
  }
}
