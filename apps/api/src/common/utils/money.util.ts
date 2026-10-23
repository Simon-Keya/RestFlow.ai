/**
 * Money helpers — use for all prices, costs, and valuations.
 * Schema may still use Float until Decimal migration is applied;
 * always route financial math through these helpers.
 */

export function roundMoney(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function toMoneyNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return roundMoney(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? roundMoney(n) : fallback;
  }
  // Prisma Decimal-like
  if (
    value &&
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    try {
      return roundMoney((value as { toNumber: () => number }).toNumber());
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function multiplyMoney(a: number, b: number): number {
  return roundMoney(toMoneyNumber(a) * toMoneyNumber(b));
}

export function addMoney(...parts: number[]): number {
  return roundMoney(parts.reduce((s, p) => s + toMoneyNumber(p), 0));
}

export function subtractMoney(a: number, b: number): number {
  return roundMoney(toMoneyNumber(a) - toMoneyNumber(b));
}

/** Store as integer minor units (cents) to avoid float drift at boundaries. */
export function toCents(value: unknown): number {
  return Math.round(toMoneyNumber(value) * 100);
}

export function fromCents(cents: number): number {
  return roundMoney(cents / 100);
}

export function percentOf(part: number, whole: number): number | null {
  const w = toMoneyNumber(whole);
  if (w === 0) return null;
  return roundMoney((toMoneyNumber(part) / w) * 100, 2);
}
