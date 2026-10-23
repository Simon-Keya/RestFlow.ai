// apps/web/src/features/trace/api.ts
import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { asArray, buildQueryString } from "@/lib/utils";
import type {
  TraceEvent,
  TraceSearchParams,
  TraceSearchResult,
  TraceItemResult,
} from "./types";

function stripHash(value?: string): string | undefined {
  if (!value) return undefined;
  const t = value.trim().replace(/^#+/, "").trim();
  return t || undefined;
}

function mapEvent(raw: Record<string, unknown>): TraceEvent {
  const payload =
    raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)
      ? (raw.payload as Record<string, unknown>)
      : {};

  const batchNumber =
    (typeof raw.batchNumber === "string" && raw.batchNumber) ||
    (typeof raw.batch_number === "string" && raw.batch_number) ||
    (typeof payload.batch_number === "string" && payload.batch_number) ||
    (typeof payload.display_batch_code === "string" &&
      payload.display_batch_code) ||
    (typeof payload.batch_id === "string" && payload.batch_id) ||
    null;

  return {
    id: String(raw.id ?? ""),
    eventType: String(raw.eventType ?? raw.event_type ?? ""),
    itemId: (raw.itemId ?? raw.item_id ?? null) as string | null,
    itemName:
      (raw.itemName as string | undefined) ??
      (typeof payload.item_name === "string" ? payload.item_name : undefined) ??
      (typeof payload.itemName === "string" ? payload.itemName : undefined) ??
      null,
    actor:
      (raw.actor as string | undefined) ??
      (raw.actorName as string | undefined) ??
      null,
    quantity: raw.quantity != null ? Number(raw.quantity) : null,
    batchNumber,
    summary: (raw.summary as string | undefined) ?? null,
    payload,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
  };
}

export const traceApi = {
  async search(
    shopId: string,
    params: TraceSearchParams,
  ): Promise<TraceSearchResult> {
    try {
      const batchNumber = stripHash(params.batchNumber);
      const itemId = stripHash(params.itemId);
      const q = stripHash(params.q);
      const eventType =
        params.eventType &&
        params.eventType !== "any" &&
        params.eventType.trim() !== ""
          ? params.eventType
          : undefined;

      const { data } = await apiClient.get(
        `${endpoints.trace.search}${buildQueryString({
          shopId,
          q,
          itemId,
          batchNumber,
          eventType,
        })}`,
      );

      const root = (data ?? {}) as Record<string, unknown>;
      const events = asArray<Record<string, unknown>>(root.events ?? []).map(
        mapEvent,
      );

      const matchedItems = asArray<Record<string, unknown>>(root.items).map(
        (row) => ({
          itemId: String(row.itemId ?? ""),
          itemName: (row.itemName as string | null) ?? null,
          eventCount: Number(row.eventCount ?? 0),
          lastEventAt: (row.lastEventAt as string | null) ?? null,
          batches: asArray<string>(row.batches),
        }),
      );

      return {
        items: events,
        total: Number(root.totalEvents ?? events.length),
        page: 1,
        pageSize: events.length || 50,
        matchedItems,
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getForItem(
    itemId: string,
    shopId?: string,
  ): Promise<TraceItemResult> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.trace.forItem(itemId)}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const events = asArray<Record<string, unknown>>(
        root.events ?? data,
      ).map(mapEvent);

      return {
        itemId: String(root.itemId ?? itemId),
        itemName: (root.itemName as string | null) ?? null,
        unit: (root.unit as string | null) ?? null,
        currentStock:
          root.currentStock != null ? Number(root.currentStock) : null,
        events,
        batches: asArray<string>(root.batches),
        relatedItemIds: asArray<string>(root.relatedItemIds),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },
};
