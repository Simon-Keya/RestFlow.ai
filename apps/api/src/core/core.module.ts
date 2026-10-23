// apps/api/src/core/core.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UnitConversionService } from '../common/units/unit-conversion.service';
import { FefoStockService } from './fefo-stock.service';
import { AdvisoryLockService } from './advisory-lock.service';
import { EventStoreService } from './event-store.service';
import { IdempotencyService } from './idempotency.service';
import { ProjectionEngineService } from './projection-engine.service';
import { SalesProjectionBackfillService } from './sales-projection-backfill.service';
import { MenuCatalogBackfillService } from './menu-catalog-backfill.service';

@Global()
@Module({
  providers: [
    PrismaService,
    EventStoreService,
    ProjectionEngineService,
    IdempotencyService,
    AdvisoryLockService,
    SalesProjectionBackfillService,
    MenuCatalogBackfillService,
    UnitConversionService,
    FefoStockService,
  ],
  exports: [
    PrismaService,
    EventStoreService,
    ProjectionEngineService,
    IdempotencyService,
    AdvisoryLockService,
    SalesProjectionBackfillService,
    MenuCatalogBackfillService,
    UnitConversionService,
    FefoStockService,
  ],
})
export class CoreModule {}
