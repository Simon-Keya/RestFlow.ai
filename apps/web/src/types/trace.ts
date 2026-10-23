export interface TraceEvent {
  id: string;
  eventType: string;
  itemId?: string | null;
  itemName?: string | null;
  actor?: string | null;
  quantity?: number | null;
  batchNumber?: string | null;
  summary?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface TraceSearchParams {
  itemId?: string;
  batchNumber?: string;
  eventType?: string;
  q?: string;
  from?: string;
  to?: string;
}

export interface TraceSearchResult {
  items: TraceEvent[];
  total: number;
  page: number;
  pageSize: number;
  matchedItems: Array<{
    itemId: string;
    itemName: string | null;
    eventCount: number;
    lastEventAt: string | null;
    batches: string[];
  }>;
}

export interface TraceItemResult {
  itemId: string;
  itemName: string | null;
  unit: string | null;
  currentStock: number | null;
  events: TraceEvent[];
  batches: string[];
  relatedItemIds: string[];
}