/**
 * Inventory accuracy % = 1 - (|counted - expected| / expected), aggregated across a variance
 * batch's line items. Used on the Variance and Dashboard screens.
 */
export function inventoryAccuracyPercent(expected: number, counted: number): number | null {
  if (!Number.isFinite(expected) || expected <= 0) return null;
  const deviation = Math.abs(counted - expected) / expected;
  return Math.max(0, 1 - deviation);
}

export interface VarianceLine {
  expectedQuantity: number;
  countedQuantity: number;
}

/** Weighted accuracy across many line items, weighted by expected quantity. */
export function aggregateInventoryAccuracy(lines: VarianceLine[]): number | null {
  const totalExpected = lines.reduce((sum, l) => sum + l.expectedQuantity, 0);
  if (totalExpected <= 0) return null;
  const totalDeviation = lines.reduce((sum, l) => sum + Math.abs(l.countedQuantity - l.expectedQuantity), 0);
  return Math.max(0, 1 - totalDeviation / totalExpected);
}
