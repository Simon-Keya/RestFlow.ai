import { roundMoney, toMoneyNumber } from '../../common/utils/money.util';

export type IngredientInput = {
  raw_item_id: string;
  raw_item_name: string;
  /**
   * Quantity of this ingredient required for one full standard recipe batch
   * (i.e. for `recipeYield` units of finished product), NOT per 1g of output
   * unless recipeYield is 1.
   */
  quantity_per_unit: number;
  unit: string;
  unit_cost: number;
};

export type VarianceLineResult = {
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
};

function roundQty(n: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Production variance lines.
 *
 * Recipe ingredients are defined for a **standard yield** (batch size).
 * Scale once:
 *   scale = planned / recipeYield
 *   expected = quantity_per_unit * scale
 *
 * Do NOT use expected = quantity_per_unit * planned when quantity_per_unit is
 * already the full-batch amount (that produced Michael's ~15,000× blow-up when
 * planned and yield were both large gram values).
 */
export function computeProductionVarianceLines(opts: {
  productItemId: string;
  productName: string;
  productUnit: string;
  plannedQuantity: number;
  actualQuantityProduced: number;
  /** Standard batch size the recipe quantities are written for. Defaults to 1 (per-unit recipes). */
  recipeYield?: number;
  productUnitCost?: number;
  ingredients: IngredientInput[];
  tolerancePercent: number;
}): {
  lines: VarianceLineResult[];
  expected_qty: number;
  actual_qty: number;
  variance_qty: number;
  variance_pct: number;
  value_affected: number;
  flagged: boolean;
  scale_planned: number;
  scale_actual: number;
  recipe_yield: number;
} {
  const planned = Number(opts.plannedQuantity) || 0;
  const actualProduced = Number(opts.actualQuantityProduced) || 0;
  const rawYield = Number(opts.recipeYield);
  const recipeYield =
    Number.isFinite(rawYield) && rawYield > 0 ? rawYield : 1;

  const scalePlanned = planned / recipeYield;
  const scaleActual = actualProduced / recipeYield;

  const lines: VarianceLineResult[] = [];

  for (const ing of opts.ingredients) {
    const qpu = Number(ing.quantity_per_unit) || 0;
    const expected = qpu * scalePlanned;
    const actual = qpu * scaleActual;
    const varianceQty = actual - expected;
    const variancePct =
      expected !== 0 ? (Math.abs(varianceQty) / Math.abs(expected)) * 100 : 0;
    const unitCost = toMoneyNumber(ing.unit_cost);
    const varianceValue = roundMoney(Math.abs(varianceQty) * unitCost);

    lines.push({
      item_id: ing.raw_item_id,
      item_name: ing.raw_item_name,
      unit: ing.unit,
      quantity_per_unit: qpu,
      expected_quantity: roundQty(expected),
      actual_quantity: roundQty(actual),
      variance_quantity: roundQty(varianceQty),
      variance_pct: roundQty(variancePct, 2),
      unit_cost: unitCost,
      variance_value: varianceValue,
    });
  }

  // Finished-good row: planned vs actual output (no ingredient scale)
  const fgVar = actualProduced - planned;
  const fgPct =
    planned !== 0 ? (Math.abs(fgVar) / Math.abs(planned)) * 100 : 0;
  const fgCost = toMoneyNumber(opts.productUnitCost ?? 0);

  lines.unshift({
    item_id: opts.productItemId,
    item_name: opts.productName,
    unit: opts.productUnit,
    quantity_per_unit: 1,
    expected_quantity: roundQty(planned),
    actual_quantity: roundQty(actualProduced),
    variance_quantity: roundQty(fgVar),
    variance_pct: roundQty(fgPct, 2),
    unit_cost: fgCost,
    variance_value: roundMoney(Math.abs(fgVar) * fgCost),
  });

  /**
   * Batch variance VALUE = finished-good output variance only.
   * Ingredient lines are explanatory (theoretical scale of materials for
   * planned vs actual yield). Summing FG + ingredients double-counted
   * (e.g. dough Ksh 36 + flour/yeast/… → Ksh 64.75). Michael 4 Oct 2026.
   */
  const valueAffected = roundMoney(Math.abs(fgVar) * fgCost);
  const variancePctHeader = fgPct;
  const flagged = variancePctHeader > opts.tolerancePercent;

  return {
    lines,
    expected_qty: roundQty(planned),
    actual_qty: roundQty(actualProduced),
    variance_qty: roundQty(fgVar),
    variance_pct: roundQty(variancePctHeader, 2),
    value_affected: valueAffected,
    flagged,
    scale_planned: scalePlanned,
    scale_actual: scaleActual,
    recipe_yield: recipeYield,
  };
}
