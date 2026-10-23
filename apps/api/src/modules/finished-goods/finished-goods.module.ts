// apps/api/src/modules/finished-goods/finished-goods.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CoreModule } from '../../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { WasteModule } from '../waste/waste.module';
import { FinishedGoodsController } from './finished-goods.controller';
import { FinishedGoodsService } from './finished-goods.service';
import { FinishedGoodsGateway } from './finished-goods.gateway';

@Module({
  imports: [CoreModule, AuthModule, WasteModule, JwtModule.register({})],
  controllers: [FinishedGoodsController],
  providers: [FinishedGoodsService, FinishedGoodsGateway],
  exports: [FinishedGoodsService],
})
export class FinishedGoodsModule {}