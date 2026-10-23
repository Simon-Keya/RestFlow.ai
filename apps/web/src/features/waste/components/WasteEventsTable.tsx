"use client";

import Link from "next/link";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { WasteCauseBadge } from "./WasteCauseBadge";
import { formatCurrency } from "@/lib/format/currency";
import { formatQuantity } from "@/lib/format/numbers";
import { formatRelativeTime } from "@/lib/format/dates";
import { routes } from "@/lib/routes";
import { PackageMinus } from "lucide-react";
import type { WasteEvent } from "../types";

export function WasteEventsTable({
  shopId,
  events,
}: {
  shopId: string;
  events?: WasteEvent[] | null;
}) {
  const list = events ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent waste events</CardTitle>
      </CardHeader>
      {list.length === 0 ? (
        <EmptyState
          icon={PackageMinus}
          title="No waste events"
          description="Recorded waste for this period will show up here."
        />
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Item</TableHeaderCell>
              <TableHeaderCell className="text-right">Quantity</TableHeaderCell>
              <TableHeaderCell>Cause</TableHeaderCell>
              <TableHeaderCell>Batch</TableHeaderCell>
              <TableHeaderCell className="text-right">Value</TableHeaderCell>
              <TableHeaderCell>Reported by</TableHeaderCell>
              <TableHeaderCell>When</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {list.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link
                    href={routes.wasteEvent(shopId, row.id)}
                    className="text-primary-700 hover:underline"
                  >
                    {row.itemName}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(row.quantity, row.unit)}
                </TableCell>
                <TableCell>
                  <WasteCauseBadge cause={row.cause} />
                </TableCell>
                <TableCell className="text-ink-muted">
                  {row.batchNumber ? (
                    <Link
                      href={routes.traceSearch(shopId, {
                        batchNumber: row.batchNumber,
                      })}
                      className="hover:underline"
                    >
                      {row.batchNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(row.value)}
                </TableCell>
                <TableCell className="text-ink-muted">{row.reportedBy}</TableCell>
                <TableCell className="text-ink-faint">
                  {formatRelativeTime(row.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
