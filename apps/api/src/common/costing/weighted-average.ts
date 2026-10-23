/**
 * Weighted average unit cost (WAC) — single formula for Nest + shared tests.
 * newAvg = (qtyOnHand * currentAvg + qtyReceived * receiptUnitCost) / (qtyOnHand + qtyReceived)
 */
export function computeWeightedAverageUnitCost(input: {
  qtyOnHand: number;
  currentAvg: number;
  qtyReceived: number;
  receiptUnitCost: number;
}): number {
  const qtyOnHand = Number(input.qtyOnHand) || 0;
  const currentAvg = Number(input.currentAvg) || 0;
  const qtyReceived = Number(input.qtyReceived) || 0;
  const receiptUnitCost = Number(input.receiptUnitCost) || 0;

  if (qtyReceived <= 0) {
    return roundCost(currentAvg);
  }
  if (qtyOnHand <= 0) {
    return roundCost(receiptUnitCost);
  }
  const numerator = qtyOnHand * currentAvg + qtyReceived * receiptUnitCost;
  const denominator = qtyOnHand + qtyReceived;
  if (denominator <= 0) {
    return roundCost(receiptUnitCost);
  }
  return roundCost(numerator / denominator);
}

export function roundCost(n: number, decimals = 6): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Value to remove on stock-out using live average (does not change avg). */
export function stockOutValue(qty: number, avgUnitCost: number): number {
  return roundMoney(Math.abs(qty) * (Number(avgUnitCost) || 0));
}
