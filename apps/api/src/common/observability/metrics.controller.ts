// apps/api/src/common/observability/metrics.controller.ts
import {
  Controller,
  Get,
  Header,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { metricsEnabled, register } from './metrics';

@Controller()
export class MetricsController {
  @Public()
  @Get('metrics')
  @Header('Content-Type', register.contentType)
  async metrics(@Req() req: Request, @Res() res: Response) {
    if (!metricsEnabled()) {
      return res.status(404).send('metrics disabled');
    }
    const token = process.env.METRICS_TOKEN;
    if (token) {
      const auth = req.headers.authorization || '';
      const q = typeof req.query.token === 'string' ? req.query.token : '';
      if (auth !== `Bearer ${token}` && q !== token) {
        throw new UnauthorizedException('metrics unauthorized');
      }
    }
    const body = await register.metrics();
    return res.status(200).send(body);
  }
}
