// apps/web/src/types/inventory.ts
export interface InventoryItem {
  itemId: string;
  name: string;
  category: string;
  unit: string;
  availableStock: number;
  reorderPoint: number;
  expiredStock: number;
  damagedStock: number;
  totalValue: number;
  /** Weighted average unit cost (WAC) from inventory projection */
  unitCost: number;
  /** True when on-hand stock exists but no WAC is available */
  costMissing?: boolean;
  daysToExpiryMin?: number | null;
  nextExpiryDate?: string | null;
  updatedAt: string;
}

export interface InventoryBatch {
  id: string;
  batchNumber: string;
  itemId: string;
  quantity: number;
  unitCost: number;
  expiryDate: string | null;
  receivedAt: string;
  supplierId?: string | null;
  remainingQuantity?: number;
  unit?: string;
}

export type StockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "near_expiry"
  | "expired";

/**
 * Past expiry wins over out-of-stock so written-off past-date lines show Expired.
 * Never treat expiredStock alone as expired when daysToExpiryMin is still ≥ 0.
 */
export function stockStatusFor(
  item: Pick<
    InventoryItem,
    "availableStock" | "reorderPoint" | "daysToExpiryMin" | "expiredStock"
  >,
): StockStatus {
  const available = Number(item.availableStock ?? 0);
  const reorder = Number(item.reorderPoint ?? 0);
  const days =
    item.daysToExpiryMin == null || Number.isNaN(Number(item.daysToExpiryMin))
      ? null
      : Number(item.daysToExpiryMin);

  if (days != null && days < 0) return "expired";
  if (available <= 0) return "out_of_stock";
  if (days != null && days <= 3) return "near_expiry";
  if (available <= reorder) return "low_stock";
  return "in_stock";
}

export function expiredUnitsFor(
  item: Pick<
    InventoryItem,
    "availableStock" | "expiredStock" | "daysToExpiryMin"
  >,
): number {
  const days =
    item.daysToExpiryMin == null || Number.isNaN(Number(item.daysToExpiryMin))
      ? null
      : Number(item.daysToExpiryMin);
  const expiredStock = Math.max(0, Number(item.expiredStock ?? 0));

  if (days != null && days < 0) {
    return expiredStock > 0
      ? expiredStock
      : Math.max(0, Number(item.availableStock ?? 0));
  }
  return 0;
}
