// apps/api/src/modules/received/received.module.ts
import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { WasteModule } from '../waste/waste.module';
import { FinishedGoodsModule } from '../finished-goods/finished-goods.module';
import { ReceivedController } from './received.controller';
import { ReceivedService } from './received.service';

@Module({
  imports: [CoreModule, AuthModule, WasteModule, FinishedGoodsModule],
  controllers: [ReceivedController],
  providers: [ReceivedService],
  exports: [ReceivedService],
})
export class ReceivedModule {}