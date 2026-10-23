/**
 * Inventory turnover = COGS / average inventory value, for the period.
 * Higher is generally better (stock isn't sitting around losing value / expiring), but
 * extremely high turnover on a specific item can also signal chronic under-ordering — the
 * UI shows the raw number rather than a red/green verdict for this one.
 */
export function inventoryTurnover(cogs: number, averageInventoryValue: number): number | null {
  if (!Number.isFinite(averageInventoryValue) || averageInventoryValue <= 0) return null;
  return cogs / averageInventoryValue;
}

/** Days of stock on hand, derived from turnover over a period of `periodDays`. */
export function daysOfStockOnHand(turnover: number | null, periodDays: number): number | null {
  if (turnover === null || turnover <= 0) return null;
  return periodDays / turnover;
}
