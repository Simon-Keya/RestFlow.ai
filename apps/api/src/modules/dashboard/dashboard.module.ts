// apps/api/src/modules/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ConsumptionModule } from '../consumption/consumption.module';

@Module({
  imports: [PrismaModule, ConsumptionModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
