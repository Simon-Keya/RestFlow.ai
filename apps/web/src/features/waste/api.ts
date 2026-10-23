// apps/web/src/features/waste/api.ts
import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { asArray, buildQueryString } from "@/lib/utils";
import type { DateRangeParams, Paginated } from "@/types/common";
import type {
  WasteEvent,
  WasteSummary,
  TopWastedItem,
  WasteCause,
} from "./types";
import type { RecordWasteInput } from "./schema";

function mapCause(raw: string): WasteCause {
  const r = raw.toLowerCase();
  if (r.includes("expir")) return "expired";
  if (r.includes("spoil") || r.includes("rot")) return "spoiled";
  if (r.includes("prep") || r.includes("cook")) return "prep_error";
  if (r.includes("return") || r.includes("customer")) return "customer_return";
  if (r.includes("over")) return "overproduction";
  return "other";
}

function mapSummary(
  raw: unknown,
): WasteSummary & { topItems: TopWastedItem[] } {
  const root = (raw ?? {}) as Record<string, unknown>;
  const byCauseRaw = root.byCause ?? root.by_waste_type ?? root.by_root_cause;

  let byCause: WasteSummary["byCause"] = [];

  if (Array.isArray(byCauseRaw)) {
    byCause = byCauseRaw.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        cause: mapCause(String(r.cause ?? r.name ?? "other")),
        value: Number(r.value ?? 0),
        quantity: Number(r.quantity ?? 0),
      };
    });
  } else if (byCauseRaw && typeof byCauseRaw === "object") {
    byCause = Object.entries(byCauseRaw as Record<string, number>).map(
      ([cause, value]) => ({
        cause: mapCause(cause),
        value: Number(value),
        quantity: 0,
      }),
    );
  }

  const topItems: TopWastedItem[] = asArray<Record<string, unknown>>(
    root.topItems ?? root.top_waste_items,
  ).map((row) => ({
    itemId: String(row.itemId ?? row.item_id ?? ""),
    name: String(row.name ?? row.itemName ?? row.item_id ?? ""),
    unit: String(row.unit ?? "pcs"),
    quantity: Number(row.quantity ?? 0),
    value: Number(row.value ?? 0),
    incidentCount: Number(row.incidentCount ?? row.count ?? 0),
  }));

  const totalWastedValue = Number(
    root.totalWastedValue ??
      root.totalWasteValue ??
      root.total_waste_value ??
      0,
  );
  const totalWastedQuantity = Number(
    root.totalWastedQuantity ??
      root.totalWasteQuantity ??
      root.total_waste_quantity ??
      0,
  );

  const wastePercentOfPurchases =
    root.wastePercentOfPurchases == null &&
    root.waste_percent_of_purchases == null
      ? null
      : Number(
          root.wastePercentOfPurchases ?? root.waste_percent_of_purchases,
        );

  return {
    totalWastedValue,
    totalWastedQuantity,
    wastePercentOfPurchases,
    byCause,
    topItems,
  };
}

function toRecordWasteBody(input: RecordWasteInput) {
  const reasonLabels: Record<string, string> = {
    expired: "expired product",
    spoiled: "spoiled product",
    prep_error: "prep or cooking error",
    customer_return: "customer return",
    overproduction: "overproduction waste",
    other: "other waste reason",
  };

  return {
    module_source: "inventory" as const,
    item_id: input.item_id.trim(),
    item_name: input.item_id.trim(),
    quantity_wasted: input.quantity,
    unit_of_measure: input.unit_of_measure ?? "pcs",
    waste_type: "spoilage" as const,
    waste_reason: reasonLabels[input.waste_reason] ?? input.waste_reason,
    root_cause: "unknown" as const,
    severity: "medium" as const,
    notes: input.notes,
    ...(input.batch_id ? { batch_id: input.batch_id } : {}),
  };
}

export const wasteApi = {
  async getSummary(
    shopId: string,
    range: DateRangeParams,
  ): Promise<WasteSummary & { topItems: TopWastedItem[] }> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.waste.analytics}${buildQueryString({
          shopId,
          from: range.from,
          to: range.to,
        })}`,
      );
      return mapSummary(data);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getEvents(
    shopId: string,
    page: number,
    pageSize: number,
    range?: DateRangeParams,
  ): Promise<Paginated<WasteEvent>> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.waste.events}${buildQueryString({
          shopId,
          page,
          pageSize,
          from: range?.from,
          to: range?.to,
        })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const items = asArray<WasteEvent>(root.items ?? data);
      return {
        items,
        total: Number(root.total ?? items.length),
        page: Number(root.page ?? page),
        pageSize: Number(root.pageSize ?? pageSize),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getEvent(eventId: string): Promise<WasteEvent> {
    try {
      const { data } = await apiClient.get(endpoints.waste.event(eventId));
      return data as WasteEvent;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async recordWaste(input: RecordWasteInput): Promise<void> {
    try {
      await apiClient.post(endpoints.waste.record, toRecordWasteBody(input));
    } catch (error) {
      throw toApiError(error);
    }
  },

  async listExpiredCandidates(shopId: string) {
    try {
      const { data } = await apiClient.get(
        `${endpoints.waste.expiredCandidates}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return asArray<Record<string, unknown>>(root.items ?? data);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async writeOffExpired(shopId: string, itemId?: string): Promise<{
    count: number;
    message: string;
  }> {
    try {
      const { data } = await apiClient.post(
        `${endpoints.waste.writeOffExpired}${buildQueryString({ shopId })}`,
        itemId ? { item_id: itemId } : {},
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return {
        count: Number(root.count ?? 0),
        message: String(root.message ?? "Done"),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },
};
