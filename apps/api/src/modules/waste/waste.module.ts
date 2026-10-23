// apps/api/src/modules/waste/waste.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CoreModule } from '../../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { WasteController } from './waste.controller';
import { WasteService } from './waste.service';
import { WasteGateway } from './waste.gateway';

@Module({
  imports: [CoreModule, AuthModule, JwtModule.register({})],
  controllers: [WasteController],
  providers: [WasteService, WasteGateway],
  exports: [WasteService],
})
export class WasteModule {}