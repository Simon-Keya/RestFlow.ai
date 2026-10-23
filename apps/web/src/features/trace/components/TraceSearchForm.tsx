// apps/web/src/features/trace/components/TraceSearchForm.tsx
"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { TraceSearchParams } from "../types";

const EVENT_TYPE_OPTIONS = [
  { value: "", label: "Any type" },
  { value: "received", label: "Received" },
  { value: "waste_recorded", label: "Waste" },
  { value: "production_finished", label: "Production finished" },
  { value: "pos_sale", label: "POS / sale" },
  { value: "refill_issued", label: "Refill issued" },
  { value: "closing_stock_counted", label: "Closing stock" },
  { value: "variance", label: "Variance" },
] as const;

export function TraceSearchForm({
  onSearch,
  isSearching,
}: {
  onSearch: (params: TraceSearchParams) => void;
  isSearching: boolean;
}) {
  const [itemQuery, setItemQuery] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [eventType, setEventType] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = itemQuery.trim();
    onSearch({
      // Send the query as 'q' for the API to search by name
      q: token || undefined,
      itemId: token || undefined,
      batchNumber: batchNumber.trim() || undefined,
      eventType: eventType.trim() || undefined,
    });
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Item name / ID / SKU
          </label>
          <Input
            value={itemQuery}
            onChange={(e) => setItemQuery(e.target.value)}
            placeholder="e.g. Yeast or TOMATO-001"
            className="w-56"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Batch number
          </label>
          <Input
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value)}
            placeholder="Optional"
            className="w-40"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Event type
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="h-10 w-48 rounded-md border border-border bg-surface px-3 text-sm text-ink"
          >
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || "any"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" loading={isSearching}>
          <Search className="h-4 w-4" />
          Search
        </Button>
      </form>
    </Card>
  );
}
