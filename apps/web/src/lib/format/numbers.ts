const NUMBER_FORMATTER = new Intl.NumberFormat("en-KE");
const COMPACT_FORMATTER = new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 });

/** Format a plain number with thousands separators, e.g. "12,450". */
export function formatNumber(value: number | string | null | undefined, fractionDigits = 0): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(num);
}

/** Compact form for KPI cards, e.g. "8.4K". */
export function formatCompactNumber(value: number | string | null | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return COMPACT_FORMATTER.format(num);
}

/** Quantity + unit, e.g. "12.5 kg", trimming trailing zeros for whole numbers. */
export function formatQuantity(value: number | string | null | undefined, unit: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const rounded = Math.round(num * 100) / 100;
  return `${NUMBER_FORMATTER.format(rounded)} ${unit}`;
}
