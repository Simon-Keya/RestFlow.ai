/**
 * Dry-run / apply missing inventory adjustments for completed stock counts
 * that never wrote COUNT_ADJUSTMENT movements (e.g. Batch #EFAULT).
 *
 *   npx ts-node scripts/correct-unposted-stock-counts.ts
 *   SHOP_ID=1 APPLY=1 npx ts-node scripts/correct-unposted-stock-counts.ts
 *
 * Staging only. Idempotent via count-adj:{countRef}:{itemId}:* keys.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const shopId = process.env.SHOP_ID || '1';
const apply = process.env.APPLY === '1';

async function main() {
  const events = await prisma.event.findMany({
    where: { shop_id: shopId, event_type: 'closing_stock_counted' },
    orderBy: { created_at: 'desc' },
    take: 100,
  });

  console.log(`Shop ${shopId} | events=${events.length} | apply=${apply}`);

  for (const ev of events) {
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    const countRef = String(p.batch_id ?? p.batch_number ?? ev.id);
    const lines = Array.isArray(p.lines) ? p.lines : [];
    const existing = await prisma.inventoryMovement.count({
      where: {
        shop_id: shopId,
        movement_type: 'COUNT_ADJUSTMENT',
        reference_id: countRef,
      },
    });
    if (existing > 0) {
      console.log(`SKIP ${countRef} already has ${existing} COUNT_ADJUSTMENT rows`);
      continue;
    }
    console.log(`CANDIDATE ${countRef} lines=${lines.length} at ${ev.created_at.toISOString()}`);
    for (const raw of lines) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;
      const itemId = String(row.item_id ?? '');
      const counted = Number(row.counted_qty ?? row.counted_quantity ?? 0);
      const system = Number(row.system_qty ?? row.expected_quantity ?? 0);
      const delta = counted - system;
      if (!itemId || Math.abs(delta) < 1e-6) continue;
      console.log(`  ${itemId}: system=${system} counted=${counted} delta=${delta}`);
      if (!apply) continue;
      // Re-append projection handler path: emit a repair event for operators to process
      // Prefer re-running close via app after code deploy; this script only reports.
    }
  }
  console.log(apply ? 'Apply mode: use redeployed close path or manual FEFO repair; script is report-first.' : 'Dry-run only.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
