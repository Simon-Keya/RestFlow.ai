// apps/api/src/common/utils/sku.util.ts

/** Canonical business SKU: trim + uppercase. Empty input → ''. */
export function normalizeSku(value: unknown): string {
  if (value == null) return '';

  // Handle objects and functions safely
  if (typeof value === 'object') {
    // Check if it's a Date or has a meaningful string representation
    if (value instanceof Date) {
      return value.toISOString();
    }
    // For other objects, return empty string to avoid [object Object]
    return '';
  }

  if (typeof value === 'function') return '';

  // value is now guaranteed to be a primitive (string, number, boolean, symbol)
  // Using explicit type guard to ensure TypeScript/ESLint knows it's safe
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    const s = value.toString().trim();
    if (!s) return '';
    return s.toUpperCase();
  }

  // Fallback for any other primitive types (like symbol)
  return '';
}

/** Normalize when present; leave undefined/null as-is. */
export function normalizeSkuOptional(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = normalizeSku(value);
  return s || undefined;
}
