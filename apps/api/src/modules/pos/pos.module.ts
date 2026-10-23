// apps/api/src/modules/pos/pos.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CoreModule } from '../../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { WasteModule } from '../waste/waste.module';
import { MenuModule } from '../menu/menu.module';
import { RecipeModule } from '../recipe/recipe.module';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { PosGateway } from './pos.gateway';

@Module({
  imports: [
    CoreModule,
    AuthModule,
    WasteModule,
    MenuModule,
    RecipeModule,
    JwtModule.register({}),
  ],
  controllers: [PosController],
  providers: [PosService, PosGateway],
  exports: [PosService],
})
export class PosModule {}
