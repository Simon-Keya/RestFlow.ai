const KES_FORMATTER = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2,
});

const KES_FORMATTER_COMPACT = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Format a numeric amount (already in KES, not cents) as currency, e.g. "KES 4,250.00". */
export function formatCurrency(amount: number | string | null | undefined): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  return KES_FORMATTER.format(value);
}

/** Compact form for KPI cards, e.g. "KES 1.2M". */
export function formatCurrencyCompact(amount: number | string | null | undefined): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  return KES_FORMATTER_COMPACT.format(value);
}

/** Signed currency for variance/delta displays, e.g. "+KES 120.00" / "-KES 45.00". */
export function formatCurrencyDelta(amount: number | string | null | undefined): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCurrency(value)}`;
}
