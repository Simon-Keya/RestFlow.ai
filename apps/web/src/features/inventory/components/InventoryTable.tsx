// apps/web/src/features/inventory/components/InventoryTable.tsx
"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { inventoryApi } from "../api";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Package } from "lucide-react";
import { formatCurrency } from "@/lib/format/currency";
import { formatQuantity } from "@/lib/format/numbers";
import { formatDateTime } from "@/lib/format/dates";
import { humanize } from "@/lib/utils";
import { stockStatusFor, type InventoryItem } from "../types";
import { StockStatusBadge } from "./StockStatusBadge";

function formatDaysToExpiry(days: number | null | undefined): string {
  if (days == null || Number.isNaN(Number(days))) return "—";
  const d = Number(days);
  if (d < 0) return `Expired ${Math.abs(Math.floor(d))}d ago`;
  if (d === 0) return "Expires today";
  if (d === 1) return "1 day";
  return `${Math.floor(d)} days`;
}

export function InventoryTable({
  items,
  shopId = "1",
  isLoading = false,
}: {
  items: InventoryItem[];
  shopId?: string;
  isLoading?: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const batchesQuery = useQuery({
    queryKey: ["inventory", "batches", shopId, expanded],
    queryFn: () => inventoryApi.getBatches(String(expanded), shopId),
    enabled: Boolean(expanded),
  });
  const list = items ?? [];

  if (isLoading && list.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-ink-muted">
        Loading stock…
      </p>
    );
  }

  if (list.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No stock rows"
        description="Receive goods or adjust filters to see inventory."
      />
    );
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Item</TableHeaderCell>
          <TableHeaderCell>Category</TableHeaderCell>
          <TableHeaderCell className="text-right">Available</TableHeaderCell>
          <TableHeaderCell className="text-right">Reorder point</TableHeaderCell>
          <TableHeaderCell className="text-right">Unit cost</TableHeaderCell>
          <TableHeaderCell className="text-right">Value</TableHeaderCell>
          <TableHeaderCell className="text-right">Days to expiry</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Last updated</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {list.map((item) => {
          const status = stockStatusFor(item);
          const days = item.daysToExpiryMin;
          const isExpanded = expanded === item.itemId;
          return (
            <Fragment key={item.itemId}>
            <TableRow>
              <TableCell className="font-medium">
                <button type="button" className="inline-flex items-center gap-2 text-left" onClick={() => setExpanded(isExpanded ? null : item.itemId)} aria-expanded={isExpanded}>
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {item.name}
                </button>
              </TableCell>
              <TableCell className="text-ink-muted">
                {humanize(item.category || "general")}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatQuantity(item.availableStock, item.unit)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-ink-muted">
                {formatQuantity(item.reorderPoint, item.unit)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {item.costMissing ? (
                  <span className="text-amber-600" title="Receive goods with unit cost to set WAC">
                    Cost missing
                  </span>
                ) : item.unitCost > 0 ? (
                  formatCurrency(item.unitCost)
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {item.costMissing ? (
                  <span className="text-amber-600">—</span>
                ) : (
                  formatCurrency(item.totalValue)
                )}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${
                  days != null && days < 0
                    ? "font-medium text-red-600"
                    : days != null && days <= 3
                      ? "font-medium text-amber-600"
                      : "text-ink-muted"
                }`}
              >
                {formatDaysToExpiry(days)}
              </TableCell>
              <TableCell>
                <StockStatusBadge status={status} />
              </TableCell>
              <TableCell className="text-ink-faint">
                {item.updatedAt ? formatDateTime(item.updatedAt) : "—"}
              </TableCell>
            </TableRow>
            {isExpanded ? <TableRow key={`${item.itemId}-batches`}>
              <TableCell colSpan={9}>
                {batchesQuery.isLoading ? <span className="text-sm text-ink-muted">Loading batches…</span> : batchesQuery.isError ? <span className="text-sm text-red-600">Could not load batches.</span> : batchesQuery.data?.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-ink-muted"><th className="p-2">Batch</th><th className="p-2">Received</th><th className="p-2">Expiry</th><th className="p-2 text-right">Remaining</th><th className="p-2 text-right">Unit cost</th><th className="p-2">Status</th></tr></thead><tbody>{batchesQuery.data.map((batch) => { const remaining = batch.remainingQuantity ?? 0; const expired = batch.expiryDate ? batch.expiryDate.slice(0, 10) < new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date()) : false; const statusLabel = remaining <= 0 ? "Depleted / written off" : expired ? "Expired — pending write-off" : "Usable / pending expiry"; return <tr key={batch.id} className="border-t border-border"><td className="p-2">{batch.batchNumber}</td><td className="p-2">{batch.receivedAt ? formatDateTime(batch.receivedAt) : "—"}</td><td className="p-2">{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : "No expiry"}</td><td className="p-2 text-right">{formatQuantity(remaining, batch.unit ?? item.unit)}</td><td className="p-2 text-right">{formatCurrency(batch.unitCost)}</td><td className={`p-2 ${remaining <= 0 || expired ? "text-red-600 font-medium" : "text-ink-muted"}`}>{statusLabel}</td></tr>; })}</tbody></table></div> : <span className="text-sm text-ink-muted">No open batches. Existing legacy stock may require opening-batch backfill.</span>}
              </TableCell>
            </TableRow> : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
