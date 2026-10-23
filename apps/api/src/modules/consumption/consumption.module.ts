// apps/api/src/modules/consumption/consumption.module.ts
import { Module } from '@nestjs/common';
import { ConsumptionController } from './consumption.controller';
import { ConsumptionService } from './consumption.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConsumptionController],
  providers: [ConsumptionService],
  exports: [ConsumptionService],
})
export class ConsumptionModule {}
