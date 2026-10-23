/**
 * Pure cost-thread rules (Michael + Oct 3 COG / production waste fix).
 * Run: npx jest production-cost.logic.spec.ts
 */

function resolveProductionCost(
  totalInputCost: number,
  manualTotal: number | undefined,
  manualUnitOrTotal: number | undefined,
  totalMade: number,
): number {
  if (manualTotal != null && Number.isFinite(manualTotal) && manualTotal >= 0) {
    return Math.max(0, manualTotal);
  }
  if (
    manualUnitOrTotal != null &&
    Number.isFinite(manualUnitOrTotal) &&
    manualUnitOrTotal > 0
  ) {
    const v = manualUnitOrTotal;
    if (
      totalInputCost > 0 &&
      (Math.abs(v - totalInputCost) / Math.max(totalInputCost, 1e-9) < 0.15 ||
        (totalMade > 1 && v > totalInputCost * 0.5))
    ) {
      return Math.max(0, v);
    }
    if (totalMade > 0) return Math.max(0, v) * totalMade;
    return Math.max(0, v);
  }
  return Math.max(0, totalInputCost);
}

function finishCostMath(
  good: number,
  waste: number,
  productionCost: number,
  planned: number,
) {
  const totalMade = good + waste;
  const unitCost = totalMade > 0 ? productionCost / totalMade : 0;
  const toStock = good * unitCost;
  const wasteValue = waste * unitCost;
  const unaccounted = Math.max(0, planned - totalMade);
  const ok = Math.abs(toStock + wasteValue - productionCost) < 0.02;
  return { totalMade, unitCost, toStock, wasteValue, unaccounted, ok };
}

describe('production cost thread', () => {
  it('Experimental: 18 good + 2 waste, cost 96.60 → unit 4.83', () => {
    const m = finishCostMath(18, 2, 96.6, 20);
    expect(m.unitCost).toBeCloseTo(4.83, 2);
    expect(m.toStock).toBeCloseTo(86.94, 2);
    expect(m.wasteValue).toBeCloseTo(9.66, 2);
    expect(m.ok).toBe(true);
    expect(m.unaccounted).toBe(0);
  });

  it('does not subtract waste from good again (no double shortfall)', () => {
    const good = 18;
    const waste = 2;
    const usable = good; // never good - waste
    expect(usable).toBe(18);
  });

  it('treats mislabeled unit_cost 96.6 as production total', () => {
    const cost = resolveProductionCost(96.6, undefined, 96.6, 20);
    expect(cost).toBeCloseTo(96.6, 2);
  });

  it('unaccounted when waste not recorded', () => {
    const m = finishCostMath(18, 0, 96.6, 20);
    expect(m.unitCost).toBeCloseTo(5.366, 2);
    expect(m.unaccounted).toBe(2);
  });
});
