// apps/web/src/features/waste/components/TopWastedItemsTable.tsx
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
import { formatCurrency } from "@/lib/format/currency";
import { formatQuantity } from "@/lib/format/numbers";
import { routes } from "@/lib/routes";
import { PackageMinus } from "lucide-react";
import type { TopWastedItem } from "../types";

export function TopWastedItemsTable({
  shopId,
  items = [],
}: {
  shopId: string;
  items?: TopWastedItem[] | null;
}) {
  const list = items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top wasted items</CardTitle>
      </CardHeader>
      {list.length === 0 ? (
        <EmptyState
          icon={PackageMinus}
          title="No waste recorded"
          description="This shop's had a clean period — nice."
        />
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Item</TableHeaderCell>
              <TableHeaderCell className="text-right">Quantity</TableHeaderCell>
              <TableHeaderCell className="text-right">Value</TableHeaderCell>
              <TableHeaderCell className="text-right">Incidents</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {list.map((item) => (
              <TableRow key={item.itemId}>
                <TableCell className="font-medium">
                  <Link
                    href={routes.traceSearch(shopId, { itemId: item.itemId })}
                    className="text-primary-700 hover:underline"
                  >
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(item.quantity, item.unit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(item.value)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-ink-muted">
                  {item.incidentCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}