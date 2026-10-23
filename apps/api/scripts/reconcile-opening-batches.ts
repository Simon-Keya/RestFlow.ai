/**
 * Safe opening-batch reconciliation.
 * Default is READ-ONLY. Pass --apply to create one opening batch only where a
 * projection has positive stock and no batches. This never writes off expired stock.
 * Run against an isolated/staging DB after backup; never use against production without review.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
  console.log(`Opening batch reconciliation mode=${apply ? 'APPLY' : 'DRY-RUN'}; no expiry write-offs will be performed.`);
  const projections = await prisma.inventoryProjection.findMany({
    where: { available_stock: { gt: 0 } },
    include: { item: { select: { name: true, unit: true } } },
    orderBy: [{ shop_id: 'asc' }, { item_id: 'asc' }],
  });
  let created = 0;
  const discrepancies: Array<Record<string, unknown>> = [];
  for (const projection of projections) {
    const batches = await prisma.inventoryBatch.findMany({
      where: { shop_id: projection.shop_id, item_id: projection.item_id },
      select: { id: true, qty_remaining: true, unit_cost: true },
    });
    const batchQty = batches.reduce((sum, batch) => sum + Number(batch.qty_remaining), 0);
    const batchValue = batches.reduce((sum, batch) => sum + Number(batch.qty_remaining) * Number(batch.unit_cost), 0);
    const projectionQty = Number(projection.available_stock);
    const projectionValue = Number(projection.total_value);
    const wacImpliedValue = projectionQty * Number(projection.avg_unit_cost);
    if (Math.abs(projectionValue - wacImpliedValue) > 0.02) {
      console.log(`WAC_VALUE_DIFFERENCE ${JSON.stringify({ shop_id: projection.shop_id, item_id: projection.item_id, item_name: projection.item.name, quantity: projectionQty, projection_total_value: projectionValue, quantity_times_wac: wacImpliedValue, difference: projectionValue - wacImpliedValue, unit: projection.item.unit })}`);
    }
    if (/crouton/i.test(projection.item.name) && Math.abs(projectionValue - projectionQty * Number(projection.avg_unit_cost)) > 0.02) {
      console.log(`CROUTONS_COSTING_REVIEW ${JSON.stringify({ shop_id: projection.shop_id, item_id: projection.item_id, quantity: projectionQty, unit: projection.item.unit, avg_unit_cost: Number(projection.avg_unit_cost), total_value: projectionValue, implied_value_at_wac: wacImpliedValue, note: 'Inspect source receipt quantities, base-unit conversions, historical WAC updates and projection movements. This script does not correct values.' })}`);
    }
    if (batches.length === 0 && projectionQty > 0) {
      const wac = Number(projection.avg_unit_cost) > 0 ? Number(projection.avg_unit_cost) : projectionValue / projectionQty;
      const proposed = { shop_id: projection.shop_id, item_id: projection.item_id, item_name: projection.item.name, quantity: projectionQty, unit: projection.item.unit, unit_cost: wac, expiry_date: projection.next_expiry_date, action: apply ? 'CREATE_OPENING_BATCH' : 'WOULD_CREATE_OPENING_BATCH' };
      console.log(JSON.stringify(proposed));
      if (apply) {
        await prisma.$transaction(async (tx) => {
          const existing = await tx.inventoryBatch.count({ where: { shop_id: projection.shop_id, item_id: projection.item_id, qty_remaining: { gt: 0 } } });
          if (existing > 0) return;
          const batch = await tx.inventoryBatch.create({ data: {
            shop_id: projection.shop_id,
            item_id: projection.item_id,
            batch_number: `OPENING-${projection.shop_id}-${projection.item_id}`.slice(0, 120),
            qty_received: projectionQty,
            qty_remaining: projectionQty,
            unit_cost: new Prisma.Decimal(Math.max(0, wac)),
            expiry_date: projection.next_expiry_date,
            received_at: projection.last_received_at ?? projection.updated_at,
          } });
          await tx.inventoryMovement.create({ data: {
            shop_id: projection.shop_id,
            batch_id: batch.id,
            item_id: projection.item_id,
            movement_type: 'OPENING_BALANCE',
            quantity: projectionQty,
            unit_cost: new Prisma.Decimal(Math.max(0, wac)),
            reference_type: 'opening_batch_backfill',
            reference_id: `opening:${projection.shop_id}:${projection.item_id}`,
            idempotency_key: `opening:${projection.shop_id}:${projection.item_id}`,
          } });
        });
        created += 1;
      }
      continue;
    }
    const qtyDiff = projectionQty - batchQty;
    const valueDiff = projectionValue - batchValue;
    if (Math.abs(qtyDiff) > 0.0001 || Math.abs(valueDiff) > 0.02) {
      const row = { shop_id: projection.shop_id, item_id: projection.item_id, item_name: projection.item.name, projection_qty: projectionQty, batch_qty: batchQty, quantity_difference: qtyDiff, projection_value: projectionValue, batch_value: batchValue, value_difference: valueDiff, unit_cost_wac: Number(projection.avg_unit_cost) };
      discrepancies.push(row);
      console.log(`RECONCILIATION_DIFFERENCE ${JSON.stringify(row)}`);
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', projections_checked: projections.length, opening_batches_created: created, discrepancies: discrepancies.length, note: 'Differences are reported, never auto-adjusted. Expired stock requires a separate owner-confirmed write-off.' }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
