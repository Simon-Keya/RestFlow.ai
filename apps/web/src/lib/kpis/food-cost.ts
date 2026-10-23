/**
 * Food cost % = cost of goods sold / revenue, for a given period.
 * The single most-watched number in restaurant ops — kept as a pure function so both the
 * dashboard KPI card and the consumption feature can compute it identically.
 */
export function foodCostPercent(cogs: number, revenue: number): number | null {
  if (!Number.isFinite(cogs) || !Number.isFinite(revenue) || revenue <= 0) return null;
  return cogs / revenue;
}

/** Standard restaurant target band; used to color-code the KPI card. */
export function foodCostStatus(ratio: number | null): "good" | "watch" | "over" | "unknown" {
  if (ratio === null) return "unknown";
  if (ratio <= 0.3) return "good";
  if (ratio <= 0.35) return "watch";
  return "over";
}
