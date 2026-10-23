/** Gross margin % = (revenue - cogs) / revenue. */
export function grossMarginPercent(revenue: number, cogs: number): number | null {
  if (!Number.isFinite(revenue) || revenue <= 0) return null;
  return (revenue - cogs) / revenue;
}

export function grossProfit(revenue: number, cogs: number): number {
  return (Number(revenue) || 0) - (Number(cogs) || 0);
}
