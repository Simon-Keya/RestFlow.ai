/**
 * CLI: npx ts-node -r tsconfig-paths/register scripts/backfill-menu-catalog.ts [shopId]
 * Or: shopId=1 node -e "..." after build
 *
 * Prefer HTTP: POST /menu/catalog/backfill (MANAGER/ADMIN)
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MenuCatalogBackfillService } from '../src/core/menu-catalog-backfill.service';

async function main() {
  const shopId = process.argv[2] || process.env.SHOP_ID || '1';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const svc = app.get(MenuCatalogBackfillService);
    if (shopId === 'all') {
      const r = await svc.backfillAllShops();
      console.log(JSON.stringify(r, null, 2));
    } else {
      const r = await svc.backfillShop(shopId);
      console.log(JSON.stringify(r, null, 2));
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
