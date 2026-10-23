// apps/web/src/features/kitchen/components/ProductionHistoryTable.tsx
"use client";

import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format/dates";
import { formatQuantity } from "@/lib/format/numbers";
import { formatCurrency } from "@/lib/format/currency";
import { History } from "lucide-react";
import type { ProductionHistoryItem } from "../types";

export function ProductionHistoryTable({
  items,
}: {
  items: ProductionHistoryItem[];
}) {
  const list = items ?? [];

  if (list.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No finished batches yet"
        description="Finished production runs will appear here as finished goods lots."
      />
    );
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Product</TableHeaderCell>
          <TableHeaderCell className="text-right">Planned</TableHeaderCell>
          <TableHeaderCell className="text-right">Actual</TableHeaderCell>
          <TableHeaderCell className="text-right">On hand</TableHeaderCell>
          <TableHeaderCell className="text-right">Unit cost</TableHeaderCell>
          <TableHeaderCell className="text-right">Value</TableHeaderCell>
          <TableHeaderCell>Batch</TableHeaderCell>
          <TableHeaderCell>Expiry</TableHeaderCell>
          <TableHeaderCell>Finished</TableHeaderCell>
          <TableHeaderCell>Production ID</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {list.map((item) => (
          <TableRow key={item.productionId}>
            <TableCell className="font-medium">
              {item.recipeName || item.itemId || "—"}
              {item.itemId ? (
                <span className="mt-0.5 block font-mono text-xs text-ink-muted">
                  {item.itemId}
                </span>
              ) : null}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {item.batchSize}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {item.actualYield != null ? item.actualYield : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {item.availableStock != null
                ? formatQuantity(item.availableStock, item.unit ?? "pcs")
                : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {item.unitCost != null && item.unitCost > 0
                ? formatCurrency(item.unitCost)
                : item.runUnitCost != null && item.runUnitCost > 0
                  ? formatCurrency(item.runUnitCost)
                  : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {item.totalValue != null && item.totalValue > 0
                ? formatCurrency(item.totalValue)
                : "—"}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {item.batchNumber ?? "—"}
            </TableCell>
            <TableCell className="text-ink-faint">
              {item.expiryDate ?? item.stockExpiry ?? "—"}
            </TableCell>
            <TableCell className="text-ink-faint">
              {item.finishedAt ? formatDateTime(item.finishedAt) : "—"}
            </TableCell>
            <TableCell className="font-mono text-xs text-ink-muted">
              {item.productionId}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
