// apps/api/src/modules/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CoreModule } from '../../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentGateway } from './payment.gateway';

@Module({
  imports: [CoreModule, AuthModule, PrismaModule],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentGateway],
  exports: [PaymentService],
})
export class PaymentModule {}
