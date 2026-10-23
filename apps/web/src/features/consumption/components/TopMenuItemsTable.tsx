// TopMenuItemsTable.tsx
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format/currency";
import { formatPercentValue } from "@/lib/format/percent";
import { routes } from "@/lib/routes";
import { UtensilsCrossed } from "lucide-react";
import type { TopConsumedMenuItem } from "../types";

export function TopMenuItemsTable({
  shopId,
  items,
}: {
  shopId: string;
  items: TopConsumedMenuItem[];
}) {
  const list = Array.isArray(items) ? items : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top menu items</CardTitle>
      </CardHeader>
      {list.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="No sales in this period" />
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Menu item</TableHeaderCell>
              <TableHeaderCell className="text-right">Units sold</TableHeaderCell>
              <TableHeaderCell className="text-right">Revenue</TableHeaderCell>
              <TableHeaderCell>Food cost %</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {list.map((item) => (
              <TableRow key={item.menuItemId}>
                <TableCell>
                  <Link
                    href={routes.consumptionMenuItem(shopId, item.menuItemId)}
                    className="font-medium text-primary-700 hover:underline"
                  >
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.unitsSold}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(item.revenue)}
                </TableCell>
                <TableCell>
                  {item.foodCostPercent == null ? (
                    "—"
                  ) : (
                    <Badge
                      tone={Number(item.foodCostPercent) > 35 ? "danger" : "success"}
                    >
                      {formatPercentValue(item.foodCostPercent)}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
