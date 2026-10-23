// apps/api/src/modules/approvals/approvals.module.ts
import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CoreModule } from '../../core/core.module';

@Module({
  imports: [PrismaModule, CoreModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
