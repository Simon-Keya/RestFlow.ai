// apps/api/src/modules/trace/trace.module.ts
import { Module } from '@nestjs/common';
import { TraceController } from './trace.controller';
import { TraceService } from './trace.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TraceController],
  providers: [TraceService],
  exports: [TraceService],
})
export class TraceModule {}
