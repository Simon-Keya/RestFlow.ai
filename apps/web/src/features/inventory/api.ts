// apps/web/src/features/inventory/api.ts
import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { asArray, buildQueryString } from "@/lib/utils";
import type { Paginated } from "@/types/common";
import type { InventoryItem, InventoryBatch } from "./types";
import type { ReceiveGoodsInput } from "./schema";

const DEFAULT_PAGE_SIZE = 20;

export interface InventoryListParams {
  shopId: string;
  search?: string;
  category?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  /** When true, include Finished Goods category rows (default API: false). */
  includeFinished?: boolean;
}

export interface InventorySummaryStats {
  shopId: string;
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowOrOutCount: number;
  expiredCount: number;
  nearExpiryCount: number;
  expiredValueAtRisk: number;
  expiringIn7DaysCount: number;
}

/** Prefer API live days; if only next_expiry_date is present, derive days client-side. */
function deriveDaysToExpiry(raw: Record<string, unknown>): number | null {
  if (raw.daysToExpiryMin != null || raw.days_to_expiry_min != null) {
    const n = Number(raw.daysToExpiryMin ?? raw.days_to_expiry_min);
    return Number.isFinite(n) ? n : null;
  }

  const next = raw.nextExpiryDate ?? raw.next_expiry_date;
  if (next == null || next === "") return null;

  const end = new Date(String(next));
  if (Number.isNaN(end.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function toInventoryItem(raw: Record<string, unknown>): InventoryItem {
  const nextRaw = raw.nextExpiryDate ?? raw.next_expiry_date;

  return {
    itemId: String(raw.itemId ?? raw.item_id ?? raw.id ?? ""),
    name: String(raw.name ?? raw.item_name ?? ""),
    category: String(raw.category ?? "General"),
    unit: String(raw.unit ?? "pcs"),
    availableStock: Number(raw.availableStock ?? raw.available_stock ?? 0),
    reorderPoint: Number(raw.reorderPoint ?? raw.reorder_point ?? 0),
    expiredStock: Number(raw.expiredStock ?? raw.expired_stock ?? 0),
    damagedStock: Number(raw.damagedStock ?? raw.damaged_stock ?? 0),
    totalValue: Number(raw.totalValue ?? raw.total_value ?? 0),
    unitCost: (() => {
      const u = Number(
        raw.unitCost ??
          raw.unit_cost ??
          raw.avgUnitCost ??
          raw.avg_unit_cost ??
          0,
      );
      if (Number.isFinite(u) && u > 0) return u;
      const qty = Number(raw.availableStock ?? raw.available_stock ?? 0);
      const tv = Number(raw.totalValue ?? raw.total_value ?? 0);
      if (qty > 0 && tv > 0) return tv / qty;
      return 0;
    })(),
    costMissing: (() => {
      const qty = Number(raw.availableStock ?? raw.available_stock ?? 0);
      const u = Number(
        raw.unitCost ??
          raw.unit_cost ??
          raw.avgUnitCost ??
          raw.avg_unit_cost ??
          0,
      );
      const tv = Number(raw.totalValue ?? raw.total_value ?? 0);
      const hasCost = (Number.isFinite(u) && u > 0) || (qty > 0 && tv > 0);
      return qty > 0 && !hasCost;
    })(),
    daysToExpiryMin: deriveDaysToExpiry(raw),
    nextExpiryDate:
      nextRaw != null && nextRaw !== "" ? String(nextRaw) : null,
    updatedAt: String(
      raw.updatedAt ?? raw.updated_at ?? raw.last_received_at ?? "",
    ),
  };
}

function toInventoryBatch(raw: Record<string, unknown>): InventoryBatch {
  return {
    id: String(raw.id ?? ""),
    batchNumber: String(raw.batchNumber ?? raw.batch_number ?? ""),
    unit: String(raw.unit ?? "pcs"),
    itemId: String(raw.itemId ?? raw.item_id ?? ""),
    quantity: Number(raw.qty_received ?? raw.quantity ?? 0),
    remainingQuantity: Number(raw.qty_remaining ?? raw.remainingQuantity ?? raw.quantity ?? 0),
    unitCost: Number(raw.unitCost ?? raw.unit_cost ?? 0),
    expiryDate:
      raw.expiryDate != null || raw.expiry_date != null
        ? String(raw.expiryDate ?? raw.expiry_date)
        : null,
    receivedAt: String(
      raw.receivedAt ?? raw.received_at ?? raw.created_at ?? "",
    ),
    supplierId:
      raw.supplierId != null || raw.supplier_id != null
        ? String(raw.supplierId ?? raw.supplier_id)
        : null,
  };
}

export const inventoryApi = {
  async list(params: InventoryListParams): Promise<Paginated<InventoryItem>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

    try {
      const { data } = await apiClient.get(
        `${endpoints.inventory.list}${buildQueryString({
          shopId: params.shopId,
          search: params.search,
          category: params.category,
          status: params.status,
          page,
          pageSize,
          limit: pageSize,
          includeFinished: params.includeFinished ? true : undefined,
        })}`,
      );

      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(
        root.items ?? root.data ?? data,
      );
      const items = rows.map(toInventoryItem).filter((i) => i.itemId);

      return {
        items,
        total: Number(root.total ?? items.length),
        page: Number(root.page ?? page),
        pageSize: Number(root.limit ?? root.pageSize ?? pageSize),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getSummary(shopId: string): Promise<InventorySummaryStats> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.inventory.summary}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return {
        shopId: String(root.shopId ?? shopId),
        totalItems: Number(root.totalItems ?? 0),
        totalValue: Number(root.totalValue ?? 0),
        lowStockCount: Number(root.lowStockCount ?? 0),
        outOfStockCount: Number(root.outOfStockCount ?? 0),
        lowOrOutCount: Number(root.lowOrOutCount ?? 0),
        expiredCount: Number(root.expiredCount ?? 0),
        nearExpiryCount: Number(root.nearExpiryCount ?? 0),
        expiredValueAtRisk: Number(root.expiredValueAtRisk ?? 0),
        expiringIn7DaysCount: Number(root.expiringIn7DaysCount ?? 0),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getBatches(itemId: string, shopId?: string): Promise<InventoryBatch[]> {
    try {
      const { data } = await apiClient.get(`${endpoints.inventory.batches(itemId)}${buildQueryString({ shopId })}`);
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(
        root.batches ?? root.items ?? data,
      );
      return rows.map((row) => toInventoryBatch({ ...row, unit: row.unit ?? root.unit }));
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getExpiryAlerts(shopId: string): Promise<Array<{ batchId: string; batchNumber: string; itemId: string; itemName: string; unit: string; quantity: number; valueAtRisk: number; expiryDate: string; daysToExpiry: number; status: string }>> {
    try {
      const { data } = await apiClient.get(`/inventory/expiry-alerts${buildQueryString({ shopId })}`);
      const root = (data ?? {}) as Record<string, unknown>;
      return asArray<Record<string, unknown>>(root.items ?? data).map((row) => ({
        batchId: String(row.batch_id ?? ''), batchNumber: String(row.batch_number ?? ''), itemId: String(row.item_id ?? ''), itemName: String(row.item_name ?? row.item_id ?? ''), unit: String(row.unit ?? 'pcs'), quantity: Number(row.quantity ?? 0), valueAtRisk: Number(row.value_at_risk ?? 0), expiryDate: String(row.expiry_date ?? ''), daysToExpiry: Number(row.days_to_expiry ?? 0), status: String(row.status ?? ''),
      }));
    } catch (error) { throw toApiError(error); }
  },

  async getAlerts(shopId: string): Promise<InventoryItem[]> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.inventory.alerts}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(
        root.items ?? root.alerts ?? data,
      );
      return rows.map(toInventoryItem).filter((i) => i.itemId);
    } catch (error) {
      throw toApiError(error);
    }
  },

  /** Full GRN payload — aligned with mobile ReceiveGoodsScreen */

  async suggest(
    shopId: string,
    q: string,
    limit = 10,
  ): Promise<
    Array<{
      itemId: string;
      name: string;
      category: string;
      unit: string;
      availableStock: number;
      lastReceivedAt: string | null;
      avgUnitCost: number;
    }>
  > {
    try {
      const { data } = await apiClient.get(
        `${endpoints.inventory.suggest}${buildQueryString({
          shopId,
          q,
          limit,
        })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = Array.isArray(root.items)
        ? root.items
        : Array.isArray(data)
          ? data
          : [];
      return rows.map((raw) => {
        const r = raw as Record<string, unknown>;
        return {
          itemId: String(r.itemId ?? r.item_id ?? ""),
          name: String(r.name ?? r.itemName ?? ""),
          category: String(r.category ?? ""),
          unit: String(r.unit ?? r.units ?? "pcs"),
          availableStock: Number(r.availableStock ?? r.available_stock ?? 0),
          lastReceivedAt: (r.lastReceivedAt ?? r.last_received_at ?? null) as
            | string
            | null,
          avgUnitCost: Number(r.avgUnitCost ?? r.avg_unit_cost ?? 0),
        };
      });
    } catch (error) {
      throw toApiError(error);
    }
  },

  async receiveGoods(input: ReceiveGoodsInput): Promise<void> {
    try {
      const qty = Number(input.quantity);
      const approved =
        input.quantity_approved != null &&
        Number.isFinite(Number(input.quantity_approved))
          ? Number(input.quantity_approved)
          : qty;
      const rejected =
        input.quantity_rejected != null &&
        Number.isFinite(Number(input.quantity_rejected))
          ? Number(input.quantity_rejected)
          : 0;
      const unitCost = Number(input.unit_cost);
      const totalCost =
        input.total_cost != null && Number.isFinite(Number(input.total_cost))
          ? Number(input.total_cost)
          : approved * unitCost;

      await apiClient.post(endpoints.received.create, {
        item_id: input.item_id.trim(),
        item_name: input.item_name.trim() || input.item_id.trim(),
        units: input.units.trim() || "units",
        category: input.category.trim(),
        quantity: qty,
        quantity_approved: approved,
        quantity_rejected: rejected,
        unit_cost: unitCost,
        total_cost: totalCost,
        batch_number: input.batch_number.trim(),
        date_received: input.date_received,
        expiry_date: input.expiry_date,
        ...(input.supplier_name?.trim()
          ? { supplier_name: input.supplier_name.trim() }
          : {}),
        ...(input.supplier_number?.trim()
          ? { supplier_number: input.supplier_number.trim() }
          : {}),
        ...(input.supplier_id?.trim()
          ? { supplier_id: input.supplier_id.trim() }
          : {}),
        ...(input.approved_by?.trim()
          ? { approved_by: input.approved_by.trim() }
          : {}),
      });
    } catch (error) {
      throw toApiError(error);
    }
  },
};