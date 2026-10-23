// apps/api/src/modules/variance/variance-engine.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DEFAULT_VARIANCE_TOLERANCE_PERCENT } from './variance.constants';
import { computeProductionVarianceLines } from './variance-math';
import { toMoneyNumber } from '../../common/utils/money.util';

export interface ProductionFinishInput {
  productionId: string;
  shopId?: string;
  itemId: string;
  itemName?: string;
  plannedQuantity: number;
  actualQuantityProduced: number;
  unitCost?: number;
  wasteQuantity?: number;
  batchNumber?: string;
}

export interface VarianceLineResult {
  item_id: string;
  item_name: string;
  unit: string;
  quantity_per_unit: number;
  expected_quantity: number;
  actual_quantity: number;
  variance_quantity: number;
  variance_pct: number;
  unit_cost: number;
  variance_value: number;
}

export interface VarianceComputeResult {
  batch_id: string;
  production_id: string;
  shop_id: string;
  product_item_id: string;
  product_name: string;
  source: 'production';
  planned_quantity: number;
  actual_quantity_produced: number;
  expected_qty: number;
  actual_qty: number;
  variance_qty: number;
  variance_pct: number;
  value_affected: number;
  flagged: boolean;
  tolerance_percent: number;
  lines: VarianceLineResult[];
  status: 'completed';
  computed_at: string;
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

function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

@Injectable()
export class VarianceEngineService {
  private readonly logger = new Logger(VarianceEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeFromProductionFinish(
    input: ProductionFinishInput,
  ): Promise<VarianceComputeResult> {
    const shopId = input.shopId || '1';
    const tolerance = DEFAULT_VARIANCE_TOLERANCE_PERCENT;
    const planned = Number(input.plannedQuantity) || 0;
    const actualProduced = Number(input.actualQuantityProduced) || 0;

    const recipe = await this.prisma.recipe.findFirst({
      where: { item_id: input.itemId },
      include: { ingredients: true },
    });

    let ingredients: Array<{
      raw_item_id: string;
      raw_item_name: string;
      quantity_per_unit: number;
      unit: string;
      unit_cost: number;
    }> = [];

    if (recipe && recipe.ingredients.length > 0) {
      ingredients = recipe.ingredients.map((ing) => ({
        raw_item_id: ing.raw_item_id,
        raw_item_name: ing.raw_item_name,
        quantity_per_unit: Number(ing.quantity_per_unit),
        unit: ing.unit,
        unit_cost: toMoneyNumber(ing.unit_cost ?? 0),
      }));
    } else {
      ingredients = await this.loadIngredientsFromEvents(input.itemId);
    }


    const recipeYield = asNumber(
      recipe?.standard_yield ?? recipe?.yield_quantity,
      0,
    );

    const math = computeProductionVarianceLines({
      productItemId: input.itemId,
      productName: input.itemName || input.itemId,
      productUnit: recipe?.unit ?? 'units',
      plannedQuantity: planned,
      actualQuantityProduced: actualProduced,
      recipeYield: recipeYield > 0 ? recipeYield : 1,
      productUnitCost: toMoneyNumber(input.unitCost ?? 0),
      ingredients: ingredients.map((ing) => ({
        ...ing,
        unit_cost: toMoneyNumber(ing.unit_cost),
      })),
      tolerancePercent: tolerance,
    });

    this.logger.debug(
      `Variance scale planned=${math.scale_planned} actual=${math.scale_actual} yield=${math.recipe_yield} production=${input.productionId}`,
    );
    if (math.scale_actual > 0 && math.scale_actual < 0.05 && math.recipe_yield >= 100) {
      this.logger.warn(
        `Variance scale_actual=${math.scale_actual} looks like piece/mass mix-up (production=${input.productionId}). Check actualQuantityProduced units.`,
      );
    }
    const lines = math.lines;
    const flagged = math.flagged;
    const valueAffected = math.value_affected;

    const batchId = input.productionId;

    this.logger.log(
      `Variance computed production=${batchId} lines=${lines.length} flagged=${flagged} pct=${math.variance_pct}`,
    );

    return {
      batch_id: batchId,
      production_id: input.productionId,
      shop_id: shopId,
      product_item_id: input.itemId,
      product_name: input.itemName || input.itemId,
      source: 'production',
      planned_quantity: planned,
      actual_quantity_produced: actualProduced,
      expected_qty: math.expected_qty,
      actual_qty: math.actual_qty,
      variance_qty: math.variance_qty,
      variance_pct: math.variance_pct,
      value_affected: math.value_affected,
      flagged: math.flagged,
      tolerance_percent: tolerance,
      lines,
      status: 'completed',
      computed_at: new Date().toISOString(),
    };
  }

  private async loadIngredientsFromEvents(itemId: string) {
    const recipeEvents = await this.prisma.event.findMany({
      where: {
        event_type: 'recipe_created',
        OR: [
          { item_id: itemId },
          { payload: { path: ['item_id'], equals: itemId } },
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    const recipeId =
      (recipeEvents[0]?.payload as { recipe_id?: string } | null)?.recipe_id ||
      null;

    const ingredientEvents = await this.prisma.event.findMany({
      where: { event_type: 'recipe_ingredient_added' },
      orderBy: { created_at: 'asc' },
      take: 500,
    });

    const out: Array<{
      raw_item_id: string;
      raw_item_name: string;
      quantity_per_unit: number;
      unit: string;
      unit_cost: number;
    }> = [];

    for (const e of ingredientEvents) {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      if (recipeId && p.recipe_id !== recipeId) continue;
      if (!recipeId && p.item_id !== itemId && p.finished_item_id !== itemId) {
        continue;
      }

      const rawId = asString(p.raw_item_id ?? e.item_id, '');
      if (!rawId) continue;

      out.push({
        raw_item_id: rawId,
        raw_item_name: asString(p.raw_item_name, rawId),
        quantity_per_unit: asNumber(p.quantity_per_unit, 0),
        unit: asString(p.unit, 'pcs'),
        unit_cost: asNumber(p.unit_cost, 0),
      });
    }

    return out;
  }
}
