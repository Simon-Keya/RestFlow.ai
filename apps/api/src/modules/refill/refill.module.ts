// apps/api/src/modules/refill/refill.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CoreModule } from '../../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { RefillController } from './refill.controller';
import { RefillService } from './refill.service';
import { RefillGateway } from './refill.gateway';

@Module({
  imports: [CoreModule, AuthModule, JwtModule.register({})],
  controllers: [RefillController],
  providers: [RefillService, RefillGateway],
  exports: [RefillService],
})
export class RefillModule {}