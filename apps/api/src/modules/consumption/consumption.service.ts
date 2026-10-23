import { toMoneyNumber } from '../../common/utils/money.util';
// apps/api/src/modules/consumption/consumption.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ConsumptionSummary,
  TopConsumedProduct,
  TopConsumedMenuItem,
  ConsumptionAlert,
} from './consumption.types';

interface IngredientUse {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  value: number;
}

interface MenuAgg {
  menuItemId: string;
  name: string;
  unitsSold: number;
  revenue: number;
  foodCostValue: number;
}

interface RecipeBomLine {
  rawItemId: string;
  rawItemName: string;
  unit: string;
  quantityPerUnit: number;
  unitCost: number;
  /** Recipe standard yield — quantity_per_unit is per full batch */
  standardYield: number;
}

function asString(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(n: number, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

@Injectable()
export class ConsumptionService {
  private readonly logger = new Logger(ConsumptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sold usage only (POS):
   * - Ingredient / FG usage from line stock_deductions (not double-counted at order level)
   * - Fallback: recipe BOM × units sold when deductions missing
   * - Revenue from pos_sale totals (events), with salesProjection as fallback
   * Production batches are excluded from food-cost % (they are not sold COGS).
   */
  async getSummary(
    shopId: string,
    from?: string,
    to?: string,
  ): Promise<ConsumptionSummary> {
    const fromDate = from ? new Date(from) : this.daysAgo(30);
    const toDate = to ? new Date(to) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const periods = this.buildPeriodKeys(fromDate, toDate);

    const [events, salesRows] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          shop_id: shopId,
          created_at: { gte: fromDate, lte: toDate },
          event_type: {
            in: [
              'pos_sale',
              'pos_order_created',
              'ORDER_PAID',
              'sale_completed',
            ],
          },
        },
        select: {
          event_type: true,
          item_id: true,
          quantity: true,
          total_cost: true,
          payload: true,
        },
        orderBy: { created_at: 'asc' },
        take: 5000,
      }),
      this.prisma.salesProjection.findMany({
        where: { shop_id: shopId, period: { in: periods } },
        select: { total_sales: true },
      }),
    ]);

    const projectionRevenue = salesRows.reduce(
      (s, r) => s + Number(r.total_sales ?? 0),
      0,
    );

    let eventRevenue = 0;
    const recipeKeys = new Set<string>();

    for (const e of events) {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      eventRevenue += asNumber(
        p.total_amount ?? p.total ?? p.revenue ?? e.total_cost,
        0,
      );
      for (const line of this.extractSaleLines(p)) {
        const id = line.itemId || line.menuItemId;
        if (id) recipeKeys.add(id);
      }
    }

    // Prefer live POS event revenue; fall back to daily projection
    const periodRevenue = eventRevenue > 0 ? eventRevenue : projectionRevenue;

    const bomByItem = await this.loadRecipeBomMap([...recipeKeys]);
    const productMap = new Map<string, IngredientUse>();
    const menuMap = new Map<string, MenuAgg>();

    for (const e of events) {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const lines = this.extractSaleLines(p);

      let anyLineHadDeductions = false;

      for (const line of lines) {
        const menuId = line.menuItemId || line.itemId;
        const soldQty = line.quantity;
        if (!menuId || soldQty <= 0) continue;

        let uses = line.deductions;
        if (uses.length > 0) {
          anyLineHadDeductions = true;
        } else {
          // BOM explode only when POS did not attach deductions
          uses = this.explodeFromMap(bomByItem, line.itemId || menuId, soldQty);
        }

        uses = await this.fillMissingUnitCosts(shopId, uses);
        this.mergeUses(productMap, uses);
        this.mergeMenu(
          menuMap,
          menuId,
          line.name,
          soldQty,
          line.lineRevenue,
          uses,
        );
      }

      // Order-level deductions only if lines had none (avoid double count)
      if (!anyLineHadDeductions) {
        const topDed = await this.fillMissingUnitCosts(
          shopId,
          this.parseDeductions(p.stock_deductions),
        );
        this.mergeUses(productMap, topDed);
      }
    }

    const topProducts: TopConsumedProduct[] = Array.from(productMap.values())
      .map((u) => ({
        itemId: u.itemId,
        name: u.name,
        unit: u.unit,
        quantityConsumed: round(u.quantity, 4),
        valueConsumed: round(u.value, 2),
      }))
      .sort((a, b) => b.valueConsumed - a.valueConsumed)
      .slice(0, 20);

    const topMenuItems: TopConsumedMenuItem[] = Array.from(menuMap.values())
      .map((m) => ({
        menuItemId: m.menuItemId,
        name: m.name,
        unitsSold: round(m.unitsSold, 2),
        revenue: round(m.revenue, 2),
        foodCostValue: round(m.foodCostValue, 2),
        // Percent 0–100 for display (e.g. 32.5 = 32.5%)
        foodCostPercent:
          m.revenue > 0 ? round((m.foodCostValue / m.revenue) * 100, 1) : null,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);

    // Full product map value (not only top 20)
    const totalConsumedValue = Array.from(productMap.values()).reduce(
      (s, p) => s + p.value,
      0,
    );

    const foodCostPercent =
      periodRevenue > 0
        ? round((totalConsumedValue / periodRevenue) * 100, 1)
        : null;

    return {
      totalConsumedValue: round(totalConsumedValue, 2),
      periodRevenue: round(periodRevenue, 2),
      foodCostPercent,
      topProducts,
      topMenuItems,
      method: 'recipe_x_usage',
    };
  }

  async byProduct(
    productId: string,
    shopId: string,
    from?: string,
    to?: string,
  ) {
    const summary = await this.getSummary(shopId, from, to);
    const row = summary.topProducts.find((p) => p.itemId === productId);

    const stock = await this.prisma.inventoryProjection.findUnique({
      where: {
        shop_id_item_id: { shop_id: shopId, item_id: productId },
      },
      include: {
        item: { select: { name: true, unit: true } },
      },
    });

    return {
      itemId: productId,
      name: stock?.item?.name ?? row?.name ?? productId,
      unit: stock?.item?.unit ?? row?.unit ?? 'pcs',
      quantityConsumed: row?.quantityConsumed ?? 0,
      valueConsumed: row?.valueConsumed ?? 0,
      availableStock: Number(stock?.available_stock ?? 0),
      history: [] as { date: string; quantity: number }[],
    };
  }

  async byMenuItem(
    menuItemId: string,
    shopId: string,
    from?: string,
    to?: string,
  ) {
    const summary = await this.getSummary(shopId, from, to);
    const row = summary.topMenuItems.find((m) => m.menuItemId === menuItemId);

    return {
      menuItemId,
      name: row?.name ?? menuItemId,
      unitsSold: row?.unitsSold ?? 0,
      revenue: row?.revenue ?? 0,
      foodCostPercent: row?.foodCostPercent ?? null,
      foodCostValue: row?.foodCostValue ?? 0,
      shopId,
      history: [] as { date: string; unitsSold: number }[],
    };
  }

  async getAlerts(shopId: string): Promise<ConsumptionAlert[]> {
    const summary = await this.getSummary(shopId);
    const alerts: ConsumptionAlert[] = [];
    const now = new Date().toISOString();

    for (const p of summary.topProducts.slice(0, 10)) {
      if (p.valueConsumed > 5000) {
        alerts.push({
          id: `cons-spike-${p.itemId}`,
          itemId: p.itemId,
          itemName: p.name,
          type: 'unusual_spike',
          message: `High consumption value for ${p.name}: ${p.valueConsumed.toFixed(0)}`,
          createdAt: now,
        });
      }
    }

    for (const m of summary.topMenuItems) {
      if (m.foodCostPercent != null && m.foodCostPercent > 45) {
        alerts.push({
          id: `cons-fc-${m.menuItemId}`,
          itemId: m.menuItemId,
          itemName: m.name,
          type: 'high_food_cost',
          message: `High food cost on ${m.name}: ${m.foodCostPercent}%`,
          createdAt: now,
        });
      }
    }

    return alerts;
  }

  private async loadRecipeBomMap(
    itemIds: string[],
  ): Promise<Map<string, RecipeBomLine[]>> {
    const map = new Map<string, RecipeBomLine[]>();
    if (itemIds.length === 0) return map;

    const unique = [...new Set(itemIds.filter(Boolean))];
    const recipes = await this.prisma.recipe.findMany({
      where: {
        OR: [{ item_id: { in: unique } }, { id: { in: unique } }],
      },
      include: {
        ingredients: {
          select: {
            raw_item_id: true,
            raw_item_name: true,
            quantity_per_unit: true,
            unit: true,
            unit_cost: true,
          },
        },
      },
      take: 200,
    });

    for (const r of recipes) {
      const yieldQty = Math.max(Number(r.standard_yield ?? 1), 0.0001);
      const lines: RecipeBomLine[] = (r.ingredients ?? []).map((ing) => ({
        rawItemId: ing.raw_item_id,
        rawItemName: ing.raw_item_name,
        unit: ing.unit,
        quantityPerUnit: Number(ing.quantity_per_unit ?? 0),
        unitCost: toMoneyNumber(ing.unit_cost ?? 0),
        standardYield: yieldQty,
      }));
      map.set(r.item_id, lines);
      map.set(r.id, lines);
    }

    return map;
  }

  /**
   * quantity_per_unit is amount for one standard_yield batch.
   * Per sold unit: (quantity_per_unit / standard_yield) × soldQty
   */
  private explodeFromMap(
    bomByItem: Map<string, RecipeBomLine[]>,
    itemId: string,
    outputQty: number,
  ): IngredientUse[] {
    if (!itemId || outputQty <= 0) return [];
    const lines = bomByItem.get(itemId);
    if (!lines?.length) return [];

    return lines.map((ing) => {
      const perUnit = ing.quantityPerUnit / Math.max(ing.standardYield, 0.0001);
      const q = perUnit * outputQty;
      return {
        itemId: ing.rawItemId,
        name: ing.rawItemName,
        unit: ing.unit,
        quantity: q,
        unitCost: ing.unitCost,
        value: q * ing.unitCost,
      };
    });
  }

  private extractSaleLines(p: Record<string, unknown>): Array<{
    menuItemId: string;
    itemId: string;
    name: string;
    quantity: number;
    lineRevenue: number;
    deductions: IngredientUse[];
  }> {
    const rawItems = Array.isArray(p.items)
      ? p.items
      : Array.isArray(p.lines)
        ? p.lines
        : [];

    return rawItems.map((raw) => {
      const row = raw as Record<string, unknown>;
      // POS payload uses menu_id / menu_name / selling_price / line_total
      const menuId = asString(
        row.menu_id ??
          row.menu_item_id ??
          row.menuItemId ??
          row.combo_id ??
          row.comboId,
      );
      const itemId = asString(
        row.item_id ?? row.recipe_item_id ?? row.sku ?? menuId,
      );
      const qty = asNumber(row.quantity ?? row.qty);
      const unitPrice = asNumber(
        row.selling_price ?? row.unit_price ?? row.price,
      );
      const lineTotal = asNumber(row.line_total);
      return {
        menuItemId: menuId || itemId,
        itemId: itemId || menuId,
        name: asString(
          row.menu_name ?? row.name ?? row.item_name,
          menuId || itemId,
        ),
        quantity: qty,
        lineRevenue: lineTotal > 0 ? lineTotal : unitPrice * qty,
        deductions: this.mergeLineDeductions(row),
      };
    });
  }

  /**
   * Prefer authoritative line stock_deductions (server-resolved once).
   * Nested selection deductions are only used when the line has none —
   * never concatenate both (that doubles combo consumption).
   */
  private mergeLineDeductions(row: Record<string, unknown>): IngredientUse[] {
    const primary = this.parseDeductions(row.stock_deductions);
    if (primary.length > 0) return primary;

    const nested: IngredientUse[] = [];
    const selections = Array.isArray(row.selections) ? row.selections : [];
    for (const sel of selections) {
      const s = sel as Record<string, unknown>;
      nested.push(
        ...this.parseDeductions(s.stock_deductions ?? s.deductions),
      );
    }
    if (nested.length > 0) return nested;

    // Combo resolved_menu_items may carry per-item deductions
    const resolved = Array.isArray(row.resolved_menu_items)
      ? row.resolved_menu_items
      : Array.isArray(row.resolvedMenuItems)
        ? row.resolvedMenuItems
        : [];
    for (const mi of resolved) {
      const m = mi as Record<string, unknown>;
      nested.push(
        ...this.parseDeductions(m.stock_deductions ?? m.deductions),
      );
    }
    return nested;
  }

  private parseDeductions(raw: unknown): IngredientUse[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((d) => {
        const row = d as Record<string, unknown>;
        const pieces = asNumber(row.quantity ?? row.actual_quantity);
        const unitCost = asNumber(row.unit_cost ?? row.unitCost);
        const lineCost = asNumber(row.line_cost ?? row.lineCost ?? row.value);
        const yieldQty = asNumber(row.yield_quantity ?? row.yieldQuantity);
        const kind = asString(row.kind, 'inventory');
        const id = asString(row.item_id ?? row.itemId);
        // FG: report yield units (g) when present so 4×400g → 1600 (Michael test 1)
        const quantity =
          kind === 'finished_good' && yieldQty > 0 ? yieldQty : pieces;
        const unit =
          kind === 'finished_good' && yieldQty > 0
            ? asString(row.weight_unit ?? row.weightUnit, 'g')
            : asString(row.unit, 'pcs');
        const value =
          lineCost > 0 ? lineCost : pieces * unitCost;
        // unitCost for display: value/quantity when we rebased qty to grams
        const effectiveUnitCost =
          quantity > 0 ? value / quantity : unitCost;
        return {
          itemId: id,
          name: asString(row.item_name ?? row.itemName, id),
          unit,
          quantity,
          unitCost: effectiveUnitCost,
          value,
        };
      })
      .filter((u) => u.itemId && u.quantity > 0);
  }

  /** Average inventory cost when deduction unit_cost is missing / zero */
  private async fillMissingUnitCosts(
    shopId: string,
    uses: IngredientUse[],
  ): Promise<IngredientUse[]> {
    const need = uses.filter((u) => u.unitCost <= 0).map((u) => u.itemId);
    if (need.length === 0) return uses;

    const unique = [...new Set(need)];
    const rows = await this.prisma.inventoryProjection.findMany({
      where: {
        shop_id: shopId,
        item_id: { in: unique },
      },
      select: {
        item_id: true,
        available_stock: true,
        total_value: true,
      },
    });

    const costById = new Map<string, number>();
    for (const r of rows) {
      const stock = Number(r.available_stock ?? 0);
      const value = Number(r.total_value ?? 0);
      if (stock > 0 && value > 0) {
        costById.set(r.item_id, value / stock);
      }
    }

    // FG recipe cost when inventory WAC missing (pieces already converted or still pcs)
    const fgCosts = await this.loadFinishedGoodPieceCosts(unique);

    return uses.map((u) => {
      if (u.unitCost > 0 && u.value > 0) return u;
      const inv = costById.get(u.itemId) ?? 0;
      const fg = fgCosts.get(u.itemId);
      if (fg && fg.costPerPiece > 0) {
        // u.quantity may already be yield grams from parseDeductions
        if (u.unit === 'g' || u.unit === 'ml') {
          const value = u.quantity * fg.costPerYield;
          return { ...u, unitCost: fg.costPerYield, value };
        }
        const value = u.quantity * fg.costPerPiece;
        return { ...u, unitCost: fg.costPerPiece, value };
      }
      const c = inv;
      return {
        ...u,
        unitCost: c,
        value: u.quantity * c,
      };
    });
  }

  /** Michael FG formula: costPerPiece = unit_weight × (ingredient batch cost / standard_yield) */
  private async loadFinishedGoodPieceCosts(
    itemIds: string[],
  ): Promise<Map<string, { costPerPiece: number; costPerYield: number; unitWeight: number }>> {
    const map = new Map<
      string,
      { costPerPiece: number; costPerYield: number; unitWeight: number }
    >();
    if (itemIds.length === 0) return map;

    const outputs = await this.prisma.recipeOutput.findMany({
      where: { item_id: { in: itemIds }, is_active: true },
      include: {
        recipe: {
          include: { ingredients: true },
        },
      },
    });

    for (const out of outputs) {
      const yieldQty = Math.max(
        Number(out.recipe?.standard_yield ?? out.recipe?.yield_quantity ?? 1),
        0.0001,
      );
      let batch = 0;
      for (const ing of out.recipe?.ingredients ?? []) {
        batch +=
          Number(ing.quantity_per_unit ?? 0) *
          Number(ing.unit_cost ?? 0);
      }
      const cpy = batch / yieldQty;
      const weight = Math.max(Number(out.unit_weight ?? 1), 0.0001);
      map.set(out.item_id, {
        costPerYield: cpy,
        unitWeight: weight,
        costPerPiece: weight * cpy,
      });
    }
    return map;
  }

  private mergeUses(
    map: Map<string, IngredientUse>,
    uses: IngredientUse[],
  ): void {
    for (const u of uses) {
      if (!u.itemId) continue;
      const prev = map.get(u.itemId);
      if (!prev) {
        map.set(u.itemId, { ...u });
      } else {
        prev.quantity += u.quantity;
        prev.value += u.value;
        if ((!prev.name || prev.name === prev.itemId) && u.name) {
          prev.name = u.name;
        }
        if (prev.unit === 'pcs' && u.unit && u.unit !== 'pcs') {
          prev.unit = u.unit;
        }
      }
    }
  }

  private mergeMenu(
    map: Map<string, MenuAgg>,
    menuId: string,
    name: string,
    units: number,
    revenue: number,
    uses: IngredientUse[],
  ): void {
    const food = uses.reduce((s, u) => s + u.value, 0);
    const prev = map.get(menuId);
    if (!prev) {
      map.set(menuId, {
        menuItemId: menuId,
        name,
        unitsSold: units,
        revenue,
        foodCostValue: food,
      });
    } else {
      prev.unitsSold += units;
      prev.revenue += revenue;
      prev.foodCostValue += food;
      if ((!prev.name || prev.name === prev.menuItemId) && name) {
        prev.name = name;
      }
    }
  }

  private daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  private buildPeriodKeys(from: Date, to: Date): string[] {
    const keys: string[] = [];
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);
    while (cur <= end) {
      keys.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return keys;
  }
}
