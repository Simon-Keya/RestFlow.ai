// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ShopScopeGuard } from './common/guards/shop-scope.guard';
import { HealthController } from './health.controller';
import { MetricsController } from './common/observability/metrics.controller';
import { PrismaModule } from '../prisma/prisma.module';

import { ConfigModule } from './config/config.module';
import { CoreModule } from './core/core.module';
import { JobsModule } from './jobs/jobs.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

import { ReceivedModule } from './modules/received/received.module';
import { RefillModule } from './modules/refill/refill.module';
import { RecipeModule } from './modules/recipe/recipe.module';
import { ProductionModule } from './modules/production/production.module';
import { FinishedGoodsModule } from './modules/finished-goods/finished-goods.module';
import { MenuModule } from './modules/menu/menu.module';

import { InventoryModule } from './modules/inventory/inventory.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { WasteModule } from './modules/waste/waste.module';
import { PosModule } from './modules/pos/pos.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentModule } from './modules/payment/payment.module';
import { SyncModule } from './modules/sync/sync.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { ConsumptionModule } from './modules/consumption/consumption.module';
import { VarianceModule } from './modules/variance/variance.module';
import { TraceModule } from './modules/trace/trace.module';
import { CostingModule } from './modules/costing/costing.module';

/** Set ENABLE_JOBS=true on Render only when Redis is configured */
const enableJobs = process.env.ENABLE_JOBS === 'true';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 10,
      },
    ]),
    CoreModule,

    AuthModule,
    UsersModule,

    ReceivedModule,
    RefillModule,
    RecipeModule,
    ProductionModule,
    FinishedGoodsModule,
    MenuModule,
    InventoryModule,
    KitchenModule,
    WasteModule,
    PosModule,
    NotificationsModule,
    PaymentModule,
    SyncModule,
    DashboardModule,
    ApprovalsModule,
    ...(enableJobs ? [JobsModule] : []),
    ConsumptionModule,
    VarianceModule,
    TraceModule,
    CostingModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ShopScopeGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
