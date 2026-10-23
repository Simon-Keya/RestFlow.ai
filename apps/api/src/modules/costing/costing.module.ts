import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CostingController } from './costing.controller';
import { CostingService } from './costing.service';

@Module({
  imports: [PrismaModule],
  controllers: [CostingController],
  providers: [CostingService],
  exports: [CostingService],
})
export class CostingModule {}
