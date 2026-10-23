// apps/mobile/src/api/closingStockApi.ts
import apiClient from './apiClient';
import { API_ENDPOINTS } from './endpoints';

export interface ClosingStockLine {
  itemId: string;
  name: string;
  unit: string;
  systemQty: number;
  countedQty: number | null;
}

export interface ClosingStockSubmitLine {
  itemId: string;
  countedQty: number;
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export async function fetchClosingStock(
  shopId: string = '1',
): Promise<ClosingStockLine[]> {
  const res = await apiClient.get(API_ENDPOINTS.KITCHEN_CLOSING_STOCK, {
    params: { shopId },
  });
  const rows = asArray<Record<string, unknown>>(res.data);
  return rows.map((raw) => ({
    itemId: String(raw.itemId ?? raw.item_id ?? ''),
    name: String(raw.name ?? raw.item_name ?? raw.itemName ?? ''),
    unit: String(raw.unit ?? 'pcs'),
    systemQty: Number(
      raw.systemQty ?? raw.system_qty ?? raw.expectedQuantity ?? 0,
    ),
    countedQty:
      raw.countedQty != null
        ? Number(raw.countedQty)
        : raw.counted_qty != null
          ? Number(raw.counted_qty)
          : null,
  }));
}

export async function submitClosingStock(
  shopId: string,
  lines: ClosingStockSubmitLine[],
  opts?: { shiftLabel?: string; notes?: string },
): Promise<void> {
  await apiClient.post(API_ENDPOINTS.KITCHEN_CLOSING_STOCK, {
    shop_id: shopId,
    shift_label: opts?.shiftLabel,
    notes: opts?.notes,
    lines: lines.map((l) => ({
      item_id: l.itemId,
      counted_qty: l.countedQty,
    })),
  });
}