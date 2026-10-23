// apps/api/src/modules/variance/variance.module.ts
import { Module } from '@nestjs/common';
import { VarianceController } from './variance.controller';
import { VarianceService } from './variance.service';
import { VarianceEngineService } from './variance-engine.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CoreModule } from '../../core/core.module';

@Module({
  imports: [PrismaModule, CoreModule],
  controllers: [VarianceController],
  providers: [VarianceService, VarianceEngineService],
  exports: [VarianceService, VarianceEngineService],
})
export class VarianceModule {}
