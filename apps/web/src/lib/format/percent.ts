/** Format a 0–1 ratio as a percentage, e.g. 0.874 -> "87.4%". */
export function formatPercent(ratio: number | string | null | undefined, fractionDigits = 1): string {
  const num = Number(ratio);
  if (!Number.isFinite(num)) return "—";
  return `${(num * 100).toFixed(fractionDigits)}%`;
}

/** Format an already-percent value (0–100), e.g. 87.4 -> "87.4%". */
export function formatPercentValue(value: number | string | null | undefined, fractionDigits = 1): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num.toFixed(fractionDigits)}%`;
}

/** Signed percent for variance displays, e.g. +4.2% / -1.8%. */
export function formatPercentDelta(ratio: number | string | null | undefined, fractionDigits = 1): string {
  const num = Number(ratio);
  if (!Number.isFinite(num)) return "—";
  const sign = num > 0 ? "+" : "";
  return `${sign}${(num * 100).toFixed(fractionDigits)}%`;
}
