export function payloadsEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function resolveShopIdFromPayload(
  payload: Record<string, unknown>,
  fallback = '1',
): string {
  const raw = payload.shop_id ?? payload.shopId;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw === 'number') return String(raw);
  return fallback;
}

export function resolveQuantityFromPayload(
  quantity: number | undefined,
  payload: Record<string, unknown>,
): number | null {
  if (typeof quantity === 'number' && Number.isFinite(quantity)) return quantity;
  const candidates = [
    payload.quantity,
    payload.quantity_approved,
    payload.actual_quantity_produced,
    payload.quantity_wasted,
    payload.issued_qty,
    payload.approved_qty,
    payload.adjustment_quantity,
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && !Number.isNaN(c)) return c;
  }
  return null;
}
