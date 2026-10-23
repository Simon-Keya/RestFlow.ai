import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UnitConversionService } from '../../common/units/unit-conversion.service';

/**
 * Single source of truth for unit cost / COGS (MEKU recipe-costing engine).
 *
 * FORMULA (per finished unit):
 *   batchCost = Σ lineCost(ingredientQty, recipeUnit, unitCost, storageUnit)
 *   unitCost  = batchCost ÷ actualYield   (yield > 0)
 *
 * lineCost converts recipe qty into the inventory/storage unit before × unit cost.
 */
export interface CostLineInput {
  itemId: string;
  quantity: number;
  /** Unit of `quantity` (recipe / usage unit), e.g. g */
  qtyUnit?: string | null;
  unitCost?: number | null;
  /** Unit unitCost is expressed in (defaults to Item.unit) */
  costUnit?: string | null;
}

export interface RecipeCostResult {
  totalCost: number;
  unitCost: number;
  yieldQuantity: number;
  lines: Array<{
    itemId: string;
    quantity: number;
    quantityInCostUnit: number;
    unitCost: number;
    lineCost: number;
    qtyUnit?: string;
    costUnit?: string;
  }>;
  missingCostItemIds: string[];
}

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

@Injectable()
export class RecipeCostingService {
  private readonly logger = new Logger(RecipeCostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly units: UnitConversionService,
  ) {}

  async computeBatchCost(
    shopId: string,
    lines: CostLineInput[],
    yieldQuantity: number,
  ): Promise<RecipeCostResult> {
    const resolved: RecipeCostResult['lines'] = [];
    const missing: string[] = [];
    let total = 0;

    for (const line of lines) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const item = await this.prisma.item.findFirst({
        where: {
          OR: [{ item_id: line.itemId }, { id: line.itemId }],
        },
      });
      const costUnit =
        line.costUnit || item?.unit || line.qtyUnit || 'pcs';
      const qtyUnit = line.qtyUnit || item?.unit || 'pcs';

      let unit =
        line.unitCost != null &&
        Number.isFinite(line.unitCost) &&
        line.unitCost > 0
          ? Number(line.unitCost)
          : await this.getItemUnitCost(shopId, line.itemId);

      if (!(unit > 0)) {
        missing.push(line.itemId);
        unit = 0;
      }

      let qtyInCost = qty;
      let lineCost = 0;
      if (unit > 0) {
        try {
          qtyInCost = this.units.qtyInCostUnit(qty, qtyUnit, costUnit);
          lineCost = roundMoney(qtyInCost * unit);
        } catch (e) {
          this.logger.warn(
            `COGS unit conversion failed item=${line.itemId}: ${
              e instanceof Error ? e.message : e
            }`,
          );
          // Fall back only when units already match after normalize
          if (this.units.areCompatible(qtyUnit, costUnit)) {
            qtyInCost = this.units.convert(qty, qtyUnit, costUnit);
            lineCost = roundMoney(qtyInCost * unit);
          } else {
            throw e;
          }
        }
      }

      total += lineCost;
      resolved.push({
        itemId: line.itemId,
        quantity: qty,
        quantityInCostUnit: qtyInCost,
        unitCost: unit,
        lineCost,
        qtyUnit: this.units.normalizeUnit(qtyUnit),
        costUnit: this.units.normalizeUnit(costUnit),
      });
    }

    total = roundMoney(total);
    const y = yieldQuantity > 0 ? yieldQuantity : 0;
    const unitCost = y > 0 ? roundMoney(total / y) : 0;

    return {
      totalCost: total,
      unitCost,
      yieldQuantity: y,
      lines: resolved,
      missingCostItemIds: missing,
    };
  }

  async getItemUnitCost(shopId: string, itemId: string): Promise<number> {
    const id = String(itemId || '').trim();
    if (!id) return 0;

    const inv = await this.prisma.inventoryProjection.findUnique({
      where: {
        shop_id_item_id: { shop_id: shopId, item_id: id },
      },
    });

    if (inv) {
      const stock = Number(inv.available_stock ?? 0);
      const value = Number(inv.total_value ?? 0);
      if (stock > 0 && value > 0) {
        return roundMoney(value / stock);
      }
    }

    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        item_id: id,
        event_type: {
          in: [
            'received',
            'goods_received',
            'stock_received',
            'production_finished',
            'refill_issued',
          ],
        },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    for (const e of events) {
      if (e.unit_cost != null && Number(e.unit_cost) > 0) {
        return roundMoney(Number(e.unit_cost));
      }
      const p = (e.payload ?? {}) as Record<string, unknown>;
      for (const c of [p.unit_cost, p.unitCost, p.cost_per_unit]) {
        const n = Number(c);
        if (Number.isFinite(n) && n > 0) return roundMoney(n);
      }
    }

    return 0;
  }

  async getItemUnitCosts(
    shopId: string,
    itemIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const unique = [
      ...new Set(itemIds.map((x) => String(x).trim()).filter(Boolean)),
    ];
    if (unique.length === 0) return map;

    const invRows = await this.prisma.inventoryProjection.findMany({
      where: { shop_id: shopId, item_id: { in: unique } },
      select: {
        item_id: true,
        available_stock: true,
        total_value: true,
      },
    });
    for (const inv of invRows) {
      const stock = Number(inv.available_stock ?? 0);
      const value = Number(inv.total_value ?? 0);
      if (stock > 0 && value > 0) {
        map.set(inv.item_id, roundMoney(value / stock));
      }
    }

    const missing = unique.filter((id) => !map.has(id) || (map.get(id) ?? 0) <= 0);
    if (missing.length === 0) return map;

    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        item_id: { in: missing },
        event_type: {
          in: [
            'received',
            'goods_received',
            'stock_received',
            'production_finished',
            'refill_issued',
          ],
        },
      },
      orderBy: { created_at: 'desc' },
      take: Math.min(missing.length * 10, 200),
    });

    for (const e of events) {
      const id = e.item_id ? String(e.item_id) : '';
      if (!id || (map.get(id) ?? 0) > 0) continue;
      if (e.unit_cost != null && Number(e.unit_cost) > 0) {
        map.set(id, roundMoney(Number(e.unit_cost)));
        continue;
      }
      const p = (e.payload ?? {}) as Record<string, unknown>;
      for (const c of [p.unit_cost, p.unitCost, p.cost_per_unit]) {
        const n = Number(c);
        if (Number.isFinite(n) && n > 0) {
          map.set(id, roundMoney(n));
          break;
        }
      }
    }

    for (const id of unique) {
      if (!map.has(id)) map.set(id, 0);
    }
    return map;
  }
}
