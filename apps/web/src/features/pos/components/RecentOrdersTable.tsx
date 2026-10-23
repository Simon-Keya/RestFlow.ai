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
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { formatCurrency } from "@/lib/format/currency";
import { formatRelativeTime } from "@/lib/format/dates";
import { routes } from "@/lib/routes";
import { ORDER_TYPE_LABELS, PAYMENT_STATUS_TONE } from "../constants";
import { ShoppingCart } from "lucide-react";
import type { PosOrderSummary } from "../types";

function shortOrderId(orderId: string | undefined | null): string {
  if (!orderId || typeof orderId !== "string") return "——";
  return orderId.slice(-6).toUpperCase();
}

export function RecentOrdersTable({
  shopId,
  orders,
}: {
  shopId: string;
  orders: PosOrderSummary[];
}) {
  const list = Array.isArray(orders) ? orders : [];

  if (list.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="No orders yet"
        description="Orders placed from the POS app will show up here."
      />
    );
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Order</TableHeaderCell>
          <TableHeaderCell>Type</TableHeaderCell>
          <TableHeaderCell className="text-right">Items</TableHeaderCell>
          <TableHeaderCell className="text-right">Total</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Payment</TableHeaderCell>
          <TableHeaderCell>Placed</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {list.map((order) => {
          const id = order.orderId || "unknown";
          return (
            <TableRow key={id} className="cursor-pointer">
              <TableCell>
                <Link
                  href={routes.order(shopId, id)}
                  className="font-medium text-primary-700 hover:underline"
                >
                  #{shortOrderId(id)}
                </Link>
              </TableCell>
              <TableCell className="text-ink-muted">
                {ORDER_TYPE_LABELS[order.orderType] ?? order.orderType ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {order.itemCount ?? 0}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(order.totalAmount ?? 0)}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status ?? "not_sent"} />
              </TableCell>
              <TableCell>
                <Badge
                  tone={
                    PAYMENT_STATUS_TONE[order.paymentStatus] ?? "neutral"
                  }
                >
                  {order.paymentStatus ?? "unpaid"}
                </Badge>
              </TableCell>
              <TableCell className="text-ink-faint">
                {order.createdAt
                  ? formatRelativeTime(order.createdAt)
                  : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
