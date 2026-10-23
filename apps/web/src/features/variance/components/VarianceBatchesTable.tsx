"use client";

import Link from "next/link";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { VarianceFlagBadge } from "./VarianceFlagBadge";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/dates";
import { routes } from "@/lib/routes";
import { ClipboardList } from "lucide-react";
import type { VarianceBatch } from "../types";

export function VarianceBatchesTable({ shopId, batches }: { shopId: string; batches: VarianceBatch[] }) {
  if (batches.length === 0) {
    return <EmptyState icon={ClipboardList} title="No variance batches yet" description="Batches appear here after a stock count is submitted." />;
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Batch</TableHeaderCell>
          <TableHeaderCell>Counted by</TableHeaderCell>
          <TableHeaderCell className="text-right">Items counted</TableHeaderCell>
          <TableHeaderCell className="text-right">Items flagged</TableHeaderCell>
          <TableHeaderCell className="text-right">Variance value</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Counted at</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {batches.map((batch) => (
          <TableRow key={batch.batchId}>
            <TableCell>
              <Link href={routes.varianceBatch(shopId, batch.batchId)} className="font-medium text-primary-700 hover:underline">
                #{batch.batchId.slice(-6).toUpperCase()}
              </Link>
            </TableCell>
            <TableCell className="text-ink-muted">{batch.countedBy}</TableCell>
            <TableCell className="text-right tabular-nums">{batch.itemsCounted}</TableCell>
            <TableCell className="text-right tabular-nums">{batch.itemsFlagged}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(batch.totalVarianceValue)}</TableCell>
            <TableCell>
              <VarianceFlagBadge status={batch.status} />
            </TableCell>
            <TableCell className="text-ink-faint">{formatDateTime(batch.countedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
