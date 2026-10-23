// apps/api/src/core/fefo-stock.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ConsumedBatchSlice = {
  batchId: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  expiryDate: Date | null;
};

export type ConsumeStockResult = {
  itemId: string;
  shopId: string;
  quantity: number;
  /** Always WAC-based unit cost for valuation */
  unitCostWac: number;
  value: number;
  slices: ConsumedBatchSlice[];
};

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'toNumber' in value) {
    try {
      const n = (value as { toNumber: () => number }).toNumber();
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function roundMoney(n: number, decimals = 6): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * FEFO moves quantity; WAC prices quantity.
 * Never cost a consumption at the picked lot's unit_cost.
 */
@Injectable()
export class FefoStockService {
  private readonly logger = new Logger(FefoStockService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * WAC after receiving qty at unitCost onto existing on-hand.
   * new_WAC = (qty_on_hand × old_WAC + qty_received × batch_unit_cost)
   *         / (qty_on_hand + qty_received)
   */
  computeNewWac(
    qtyOnHand: number,
    oldWac: number,
    qtyReceived: number,
    batchUnitCost: number,
  ): number {
    const onHand = Math.max(0, qtyOnHand);
    const received = Math.max(0, qtyReceived);
    if (onHand + received <= 0) return 0;
    const old = Math.max(0, oldWac);
    const batch = Math.max(0, batchUnitCost);
    return roundMoney((onHand * old + received * batch) / (onHand + received));
  }

  async getWac(shopId: string, itemId: string): Promise<number> {
    const row = await this.prisma.inventoryProjection.findUnique({
      where: {
        shop_id_item_id: { shop_id: shopId || '1', item_id: itemId },
      },
    });
    if (!row) return 0;
    let wac = asNumber(row.avg_unit_cost, 0);
    const stock = asNumber(row.available_stock, 0);
    const value = asNumber(row.total_value, 0);
    if (wac <= 0 && stock > 0 && value > 0) {
      wac = roundMoney(value / stock);
    }
    return wac;
  }

  /**
   * Create a physical lot from GRN / stock increase and update projection WAC + roll-ups.
   * Caller still owns inventoryProjection qty/value upsert; this owns the batch row + WAC fields.
   */
  async recordReceiveBatch(opts: {
    shopId: string;
    itemId: string;
    batchNumber: string;
    quantity: number;
    unitCost: number;
    expiryDate?: Date | null;
    supplierId?: string | null;
    eventId?: string | null;
    /** Stock qty BEFORE this receive (for WAC formula) */
    qtyOnHandBefore: number;
    /** WAC BEFORE this receive */
    oldWac: number;
    movementType?: string;
  }): Promise<{ newWac: number; batchId: string }> {
    const qty = Math.max(0, opts.quantity);
    const unitCost = Math.max(0, opts.unitCost);
    if (qty <= 0) {
      return { newWac: opts.oldWac, batchId: '' };
    }

    const newWac = this.computeNewWac(
      opts.qtyOnHandBefore,
      opts.oldWac,
      qty,
      unitCost,
    );

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryBatch.create({
        data: {
          shop_id: opts.shopId || '1',
          item_id: opts.itemId,
          batch_number: opts.batchNumber || `AUTO-${Date.now()}`,
          qty_received: qty,
          qty_remaining: qty,
          unit_cost: new Prisma.Decimal(unitCost),
          expiry_date: opts.expiryDate ?? null,
          supplier_id: opts.supplierId ?? null,
          event_id: opts.eventId ?? null,
          received_at: new Date(),
        },
      });
      await tx.inventoryMovement.create({
        data: {
          shop_id: opts.shopId || '1',
          batch_id: created.id,
          item_id: opts.itemId,
          movement_type: opts.movementType ?? 'RECEIPT',
          quantity: qty,
          unit_cost: new Prisma.Decimal(unitCost),
          reference_type: 'receipt',
          reference_id: opts.eventId ?? created.id,
          idempotency_key: opts.eventId ? `receipt:${opts.eventId}:${opts.itemId}` : `receipt:${created.id}`,
        },
      });
      return created;
    });

    await this.prisma.inventoryProjection.updateMany({
      where: {
        shop_id: opts.shopId || '1',
        item_id: opts.itemId,
      },
      data: {
        avg_unit_cost: new Prisma.Decimal(newWac),
        last_receipt_unit_cost: new Prisma.Decimal(unitCost),
        ...(opts.expiryDate
          ? { next_expiry_date: opts.expiryDate }
          : {}),
      },
    });

    // Refresh nearest expiry across open lots
    await this.refreshNearestExpiry(opts.shopId || '1', opts.itemId);

    this.logger.debug(
      `Receive batch ${batch.batch_number} item=${opts.itemId} qty=${qty} unitCost=${unitCost} newWac=${newWac}`,
    );

    return { newWac, batchId: batch.id };
  }

  async refreshNearestExpiry(shopId: string, itemId: string): Promise<void> {
    const open = await this.prisma.inventoryBatch.findMany({
      where: {
        shop_id: shopId,
        item_id: itemId,
        qty_remaining: { gt: 0 },
        expiry_date: { not: null },
      },
      orderBy: { expiry_date: 'asc' },
      take: 1,
      select: { expiry_date: true },
    });
    const nearest = open[0]?.expiry_date ?? null;
    let days: number | null = null;
    if (nearest) {
      const ms = nearest.getTime() - Date.now();
      days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    }
    await this.prisma.inventoryProjection.updateMany({
      where: { shop_id: shopId, item_id: itemId },
      data: {
        next_expiry_date: nearest,
        days_to_expiry_min: days,
      },
    });
  }

  /**
   * Drain open lots nearest-expiry-first. Does not update InventoryProjection
   * (caller / projection engine still owns aggregate qty); returns slices + WAC value.
   */
  async consumeStock(
    shopId: string,
    itemId: string,
    qtyNeeded: number,
    options?: { allowPartial?: boolean; referenceType?: string; referenceId?: string; userId?: string; movementType?: string },
  ): Promise<ConsumeStockResult> {
    const need = Math.max(0, qtyNeeded);
    const shop = shopId || '1';
    if (!Number.isFinite(need) || need < 0) {
      throw new BadRequestException('Requested stock quantity must be valid');
    }
    if (need <= 0) {
      return {
        itemId,
        shopId: shop,
        quantity: 0,
        unitCostWac: await this.getWac(shop, itemId),
        value: 0,
        slices: [],
      };
    }

    // Preserve legacy opening-stock support, but do it before the locked allocation.
    await this.ensureOpenLots(shop, itemId);

    // Expiry dates are treated as shop-local calendar dates. A batch expiring today
    // remains usable until the next midnight in Africa/Nairobi.
    const todayStart = this.shopLocalDayStart(new Date());
    const allocation = await this.prisma.$transaction(async (tx) => {
      // Lock the eligible rows and read the post-lock quantities. PostgreSQL rechecks
      // the predicate after waiting for a concurrent updater, preventing stale drains.
      const batches = await tx.$queryRaw<Array<{
        id: string;
        batch_number: string;
        qty_remaining: number;
        unit_cost: Prisma.Decimal;
        expiry_date: Date | null;
        received_at: Date;
      }>>`SELECT id, batch_number, qty_remaining, unit_cost, expiry_date, received_at
          FROM "InventoryBatch"
          WHERE shop_id = ${shop} AND item_id = ${itemId}
            AND qty_remaining > 0
            AND (expiry_date IS NULL OR expiry_date >= ${todayStart})
          ORDER BY expiry_date ASC NULLS LAST, received_at ASC, id ASC
          FOR UPDATE`;

      const usable = batches.reduce(
        (sum, batch) => sum + Math.max(0, Number(batch.qty_remaining)),
        0,
      );
      if (usable + 1e-9 < need && !options?.allowPartial) {
        throw new BadRequestException(
          `Insufficient usable stock for ${itemId}: requested ${roundMoney(need, 4)}, available ${roundMoney(usable, 4)}`,
        );
      }

      let remaining = need;
      const slices: ConsumedBatchSlice[] = [];
      for (const batch of batches) {
        if (remaining <= 1e-9) break;
        const available = Math.max(0, Number(batch.qty_remaining));
        if (available <= 0) continue;
        const take = Math.min(available, remaining);
        const nextQty = Math.max(0, available - take);
        await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: { qty_remaining: nextQty },
        });
        await tx.inventoryMovement.create({
          data: {
            shop_id: shop,
            batch_id: batch.id,
            item_id: itemId,
            movement_type: options?.movementType ?? (options?.referenceType === 'production_finished' ? 'PRODUCTION_INPUT' : 'CONSUMPTION'),
            quantity: -take,
            unit_cost: new Prisma.Decimal(asNumber(batch.unit_cost, 0)),
            reference_type: options?.referenceType ?? 'consumption',
            reference_id: options?.referenceId ?? null,
            user_id: options?.userId ?? null,
            idempotency_key: options?.referenceId ? `${options.referenceType ?? 'consumption'}:${options.referenceId}:${batch.id}:${slices.length}` : null,
          },
        });
        remaining = Math.max(0, remaining - take);
        slices.push({
          batchId: batch.id,
          batchNumber: batch.batch_number,
          quantity: take,
          unitCost: asNumber(batch.unit_cost, 0),
          expiryDate: batch.expiry_date,
        });
      }
      return { remaining, slices, consumed: need - remaining };
    }, { maxWait: 20000, timeout: 30000 });

    const unitCostWac = await this.getWac(shop, itemId);
    const value = roundMoney(allocation.consumed * unitCostWac, 4);
    await this.refreshNearestExpiry(shop, itemId);

    this.logger.debug(
      `FEFO consume ${itemId} qty=${allocation.consumed} slices=${allocation.slices.length} wac=${unitCostWac}`,
    );

    return {
      itemId,
      shopId: shop,
      quantity: allocation.consumed,
      unitCostWac,
      value,
      slices: allocation.slices,
    };
  }

  /** Start of the current calendar day in the shop's Africa/Nairobi timezone. */
  private shopLocalDayStart(now: Date): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const part = (type: string) => parts.find((p) => p.type === type)?.value;
    const year = Number(part('year'));
    const month = Number(part('month'));
    const day = Number(part('day'));
    // Nairobi is UTC+03:00 and has no DST; midnight local is 21:00 UTC prior day.
    return new Date(Date.UTC(year, month - 1, day) - 3 * 60 * 60 * 1000);
  }

  /**
   * If projection has stock but no open lots, seed one synthetic lot so FEFO can run.
   */
  async ensureOpenLots(shopId: string, itemId: string): Promise<void> {
    // Only seed truly legacy projection-only items. A depleted historical batch
    // means the item has already entered batch accounting and must never be reseeded.
    const batchCount = await this.prisma.inventoryBatch.count({
      where: { shop_id: shopId, item_id: itemId },
    });
    if (batchCount > 0) return;

    const proj = await this.prisma.inventoryProjection.findUnique({
      where: {
        shop_id_item_id: { shop_id: shopId, item_id: itemId },
      },
    });
    const stock = asNumber(proj?.available_stock, 0);
    if (stock <= 0) return;

    let unitCost = asNumber(proj?.avg_unit_cost, 0);
    if (unitCost <= 0 && stock > 0) {
      unitCost = asNumber(proj?.total_value, 0) / stock;
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryBatch.count({ where: { shop_id: shopId, item_id: itemId } });
      if (existing > 0) return;
      const batch = await tx.inventoryBatch.create({
        data: {
          shop_id: shopId,
          item_id: itemId,
          batch_number: `SEED-${itemId.slice(0, 12)}`,
          qty_received: stock,
          qty_remaining: stock,
          unit_cost: new Prisma.Decimal(Math.max(0, unitCost)),
          expiry_date: proj?.next_expiry_date ?? null,
          received_at: proj?.last_received_at ?? new Date(),
        },
      });
      await tx.inventoryMovement.create({
        data: {
          shop_id: shopId,
          batch_id: batch.id,
          item_id: itemId,
          movement_type: 'OPENING_BALANCE',
          quantity: stock,
          unit_cost: new Prisma.Decimal(Math.max(0, unitCost)),
          reference_type: 'legacy_opening_stock',
          reference_id: `opening:${shopId}:${itemId}`,
          idempotency_key: `opening:${shopId}:${itemId}`,
        },
      });
    });

    this.logger.log(
      `Seeded synthetic FEFO lot for ${itemId} qty=${stock} shop=${shopId}`,
    );
  }

  /**
   * Shop-wide usable stock map: remaining > 0 and not past shop-local expiry.
   * Single source for Inventory list, menu maxPortions, POS-facing Nest paths.
   */
  async getUsableStockByItemMap(
    shopId: string,
  ): Promise<Map<string, { qty: number; value: number }>> {
    const shop = shopId || '1';
    const todayStart = this.shopLocalDayStart(new Date());
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        shop_id: shop,
        qty_remaining: { gt: 0 },
        OR: [{ expiry_date: null }, { expiry_date: { gte: todayStart } }],
      },
      select: { item_id: true, qty_remaining: true, unit_cost: true },
    });
    const map = new Map<string, { qty: number; value: number }>();
    for (const b of batches) {
      const q = Math.max(0, Number(b.qty_remaining));
      const c = Number(b.unit_cost ?? 0);
      const cur = map.get(b.item_id) ?? { qty: 0, value: 0 };
      cur.qty += q;
      cur.value += q * c;
      map.set(b.item_id, cur);
    }
    return map;
  }
}
