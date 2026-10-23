// apps/api/src/modules/production/production.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CoreModule } from '../../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { KitchenModule } from '../kitchen/kitchen.module';
import { RecipeModule } from '../recipe/recipe.module';
import { WasteModule } from '../waste/waste.module';
import { VarianceModule } from '../variance/variance.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { PrePrepService } from './pre-prep.service';
import { ProductionGateway } from './production.gateway';

@Module({
  imports: [
    CoreModule,
    AuthModule,
    forwardRef(() => KitchenModule),
    RecipeModule,
    WasteModule,
    VarianceModule,
    PrismaModule,
    JwtModule.register({}),
  ],
  controllers: [ProductionController],
  providers: [ProductionService, PrePrepService, ProductionGateway],
  exports: [ProductionService, PrePrepService],
})
export class ProductionModule {}
