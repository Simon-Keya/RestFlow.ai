// apps/api/src/modules/costing/costing.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Unit-cost resolution (Original COG + Michael / Oct 3):
 * 1. Inventory WAC (on-hand value / stock or avg_unit_cost)
 * 2. Latest production_finished unit_cost for this SKU
 * 3. Recipe cost per yield (standard) when this SKU is a recipe output
 * 4. Latest receipt unit_cost
 *
 * Never silently return 0 when a recipe or production cost exists.
 */

type InventoryCostRow = {
  shop_id: string;
  item_id: string;
  available_stock?: unknown;
  total_value?: unknown;
  avg_unit_cost?: unknown;
  last_receipt_unit_cost?: unknown;
  item?: { name?: string | null; unit?: string | null } | null;
};

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function roundMoney(n: number, dp = 6): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export type UnitCostResult = {
  shopId: string;
  itemId: string;
  avgUnitCost: number;
  availableStock: number;
  totalValue: number;
  lastReceiptUnitCost: number | null;
  name: string | null;
  unit: string | null;
  /** finished_lot | production | recipe_estimate | inventory_wac | receipt | missing */
  costSource: string;
};

@Injectable()
export class CostingService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvgUnitCost(shopId: string, itemId: string): Promise<UnitCostResult> {
    const sid = shopId || '1';
    const id = String(itemId || '').trim();
    const empty: UnitCostResult = {
      shopId: sid,
      itemId: id,
      avgUnitCost: 0,
      availableStock: 0,
      totalValue: 0,
      lastReceiptUnitCost: null,
      name: null,
      unit: null,
      costSource: 'missing',
    };
    if (!id) return empty;

    const row = (await this.prisma.inventoryProjection.findUnique({
      where: { shop_id_item_id: { shop_id: sid, item_id: id } },
      include: { item: { select: { name: true, unit: true } } },
    })) as InventoryCostRow | null;

    const availableStock = asNumber(row?.available_stock, 0);
    const totalValue = asNumber(row?.total_value, 0);
    let wac = asNumber(row?.avg_unit_cost, 0);
    if (wac <= 0 && availableStock > 0 && totalValue > 0) {
      wac = roundMoney(totalValue / availableStock);
    }

    const lastReceiptRaw = row?.last_receipt_unit_cost;
    const lastReceiptUnitCost =
      lastReceiptRaw != null ? asNumber(lastReceiptRaw, 0) : null;

    // Priority 1: on-hand WAC
    if (wac > 0 && availableStock > 0) {
      return {
        shopId: sid,
        itemId: id,
        avgUnitCost: wac,
        availableStock,
        totalValue,
        lastReceiptUnitCost:
          lastReceiptUnitCost != null && lastReceiptUnitCost > 0
            ? lastReceiptUnitCost
            : null,
        name: row?.item?.name ?? null,
        unit: row?.item?.unit ?? null,
        costSource: 'inventory_wac',
      };
    }

    // Priority 2: latest production lot unit cost
    const prod = await this.latestProductionUnitCost(sid, id);
    if (prod > 0) {
      return {
        shopId: sid,
        itemId: id,
        avgUnitCost: prod,
        availableStock,
        totalValue,
        lastReceiptUnitCost:
          lastReceiptUnitCost != null && lastReceiptUnitCost > 0
            ? lastReceiptUnitCost
            : null,
        name: row?.item?.name ?? null,
        unit: row?.item?.unit ?? null,
        costSource: 'production',
      };
    }

    // Priority 3: recipe cost per yield (Michael — menu FG before production)
    const recipeUnit = await this.recipeCostPerYield(sid, id);
    if (recipeUnit > 0) {
      return {
        shopId: sid,
        itemId: id,
        avgUnitCost: recipeUnit,
        availableStock,
        totalValue,
        lastReceiptUnitCost:
          lastReceiptUnitCost != null && lastReceiptUnitCost > 0
            ? lastReceiptUnitCost
            : null,
        name: row?.item?.name ?? null,
        unit: row?.item?.unit ?? null,
        costSource: 'recipe_estimate',
      };
    }

    // Priority 4: last receipt / WAC with no stock / any stored wac
    if (wac > 0) {
      return {
        shopId: sid,
        itemId: id,
        avgUnitCost: wac,
        availableStock,
        totalValue,
        lastReceiptUnitCost:
          lastReceiptUnitCost != null && lastReceiptUnitCost > 0
            ? lastReceiptUnitCost
            : null,
        name: row?.item?.name ?? null,
        unit: row?.item?.unit ?? null,
        costSource: 'inventory_wac',
      };
    }
    if (lastReceiptUnitCost != null && lastReceiptUnitCost > 0) {
      return {
        shopId: sid,
        itemId: id,
        avgUnitCost: lastReceiptUnitCost,
        availableStock,
        totalValue,
        lastReceiptUnitCost,
        name: row?.item?.name ?? null,
        unit: row?.item?.unit ?? null,
        costSource: 'receipt',
      };
    }

    return {
      ...empty,
      availableStock,
      totalValue,
      name: row?.item?.name ?? null,
      unit: row?.item?.unit ?? null,
    };
  }

  async getAvgUnitCosts(shopId: string, itemIds: string[]) {
    const ids = [...new Set(itemIds.map((id) => id.trim()).filter(Boolean))];
    const costs: Record<string, number> = {};
    const sources: Record<string, string> = {};
    await Promise.all(
      ids.map(async (id) => {
        const row = await this.getAvgUnitCost(shopId || '1', id);
        costs[id] = row.avgUnitCost;
        sources[id] = row.costSource;
      }),
    );
    return { shopId: shopId || '1', costs, sources };
  }

  private async latestProductionUnitCost(
    shopId: string,
    itemId: string,
  ): Promise<number> {
    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        item_id: itemId,
        event_type: 'production_finished',
      },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: { unit_cost: true, payload: true },
    });
    for (const e of events) {
      const uc = asNumber(e.unit_cost, 0);
      if (uc > 0) return roundMoney(uc);
      const p = (e.payload ?? {}) as Record<string, unknown>;
      for (const k of ['unit_cost', 'unitCost', 'finishedUnitCost', 'std_unit_cost']) {
        const n = asNumber(p[k], 0);
        if (n > 0) return roundMoney(n);
      }
    }
    return 0;
  }

  /**
   * Recipe standard cost per yield for a finished SKU (output item_id).
   * Uses latest recipe_* event payload ingredients × current inventory WAC when possible.
   */
  private async recipeCostPerYield(
    shopId: string,
    finishedItemId: string,
  ): Promise<number> {
    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: { in: ['recipe_created', 'recipe_updated'] },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
      select: { payload: true },
    });

    for (const e of events) {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const outputs = Array.isArray(p.outputs) ? p.outputs : [];
      const outMatch = outputs.some((o) => {
        if (!o || typeof o !== 'object') return false;
        const r = o as Record<string, unknown>;
        const oid = String(r.item_id ?? r.itemId ?? r.sku ?? '').trim();
        return oid.toUpperCase() === finishedItemId.toUpperCase();
      });
      const primaryId = String(
        p.item_id ?? p.itemId ?? p.finished_item_id ?? p.sku ?? '',
      ).trim();
      const isPrimary =
        primaryId.toUpperCase() === finishedItemId.toUpperCase();
      if (!outMatch && !isPrimary) continue;

      // Prefer stored cost_per_yield / unitCost on recipe payload
      for (const k of [
        'cost_per_yield',
        'costPerYield',
        'std_unit_cost',
        'standard_unit_cost',
        'unit_cost',
        'unitCost',
      ]) {
        const n = asNumber(p[k], 0);
        if (n > 0) return roundMoney(n);
      }

      const batchCost = asNumber(p.batch_cost ?? p.batchCost ?? p.total_cost, 0);
      const yieldQty = asNumber(
        p.standard_yield ?? p.standardYield ?? p.yield_qty ?? p.yieldQuantity,
        0,
      );
      if (batchCost > 0 && yieldQty > 0) {
        return roundMoney(batchCost / yieldQty);
      }

      // Compute from ingredients if present
      const ingredients = Array.isArray(p.ingredients) ? p.ingredients : [];
      if (ingredients.length > 0 && yieldQty > 0) {
        let total = 0;
        for (const ing of ingredients) {
          if (!ing || typeof ing !== 'object') continue;
          const r = ing as Record<string, unknown>;
          const iid = String(r.item_id ?? r.itemId ?? r.raw_item_id ?? '').trim();
          const qty = asNumber(
            r.quantity ?? r.qty ?? r.quantity_per_unit ?? r.quantityPerUnit,
            0,
          );
          let uc = asNumber(r.unit_cost ?? r.unitCost, 0);
          if (uc <= 0 && iid) {
            const inv = await this.prisma.inventoryProjection.findUnique({
              where: {
                shop_id_item_id: { shop_id: shopId, item_id: iid },
              },
            });
            uc = asNumber(inv?.avg_unit_cost, 0);
            const stock = asNumber(inv?.available_stock, 0);
            const val = asNumber(inv?.total_value, 0);
            if (uc <= 0 && stock > 0 && val > 0) uc = val / stock;
          }
          total += qty * Math.max(0, uc);
        }
        if (total > 0) return roundMoney(total / yieldQty);
      }
    }
    return 0;
  }
}
