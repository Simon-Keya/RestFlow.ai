// apps/api/src/modules/kitchen/kitchen.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ProductionModule } from '../production/production.module';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';

@Module({
  imports: [
    CoreModule,
    AuthModule,
    PrismaModule,
    forwardRef(() => ProductionModule),
  ],
  controllers: [KitchenController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}
