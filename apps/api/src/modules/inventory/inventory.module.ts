import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CoreModule } from '../../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryGateway } from './inventory.gateway';

@Module({
  imports: [CoreModule, AuthModule, JwtModule.register({})],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryGateway],
  exports: [InventoryService],
})
export class InventoryModule {}
