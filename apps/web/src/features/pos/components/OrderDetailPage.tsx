"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChefHat } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ErrorState } from "@/components/ui/ErrorState";
import { FullPageSpinner } from "@/components/feedback/FullPageSpinner";
import { formatCurrency } from "@/lib/format/currency";
import { routes } from "@/lib/routes";
import { ApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/ToastProvider";

import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderLifecycleTimeline } from "./OrderLifecycleTimeline";
import { ORDER_TYPE_LABELS, PAYMENT_STATUS_TONE } from "../constants";
import { useOrderDetail } from "../hooks/use-order-detail";
import { posApi } from "../api";

export function OrderDetailPage({
  shopId,
  orderId,
}: {
  shopId: string;
  orderId: string;
}) {
  const order = useOrderDetail(orderId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sendMutation = useMutation({
    mutationFn: () => posApi.sendToKitchen(orderId, shopId),
    onSuccess: (res) => {
      toast({
        title: "Sent to kitchen",
        description: res.message,
        variant: "success",
      });
      void queryClient.invalidateQueries({
        queryKey: ["pos", "order", orderId],
      });
      void queryClient.invalidateQueries({ queryKey: ["pos"] });
      void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
    },
  });

  const payMutation = useMutation({
    mutationFn: (status: "paid" | "unpaid" | "pending") =>
      posApi.updatePayment(orderId, {
        payment_status: status,
        shop_id: shopId,
      }),
    onSuccess: (res) => {
      toast({
        title: "Payment updated",
        description: res.message,
        variant: "success",
      });
      void queryClient.invalidateQueries({
        queryKey: ["pos", "order", orderId],
      });
      void queryClient.invalidateQueries({ queryKey: ["pos"] });
    },
  });

  if (order.isPending) return <FullPageSpinner label="Loading order…" />;
  if (order.isError) {
    return (
      <ErrorState
        title="Couldn't load this order"
        description={order.error.message}
        onRetry={order.refetch}
      />
    );
  }

  const { data } = order;
  const kitchenKey = String(data.kitchenStatus ?? data.status ?? "not_sent");
  const sent =
    data.sentToKitchen === true ||
    ["pending", "preparing", "ready", "served", "completed"].includes(
      kitchenKey,
    );

  const customerBits = [
    data.tableNumber ? `Table ${data.tableNumber}` : null,
    data.customerName ?? null,
    data.customerPhone ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  const orderTypeLabel =
    ORDER_TYPE_LABELS[data.orderType] ?? data.orderType ?? "Order";

  const actionError =
    sendMutation.error instanceof ApiError
      ? sendMutation.error.message
      : payMutation.error instanceof ApiError
        ? payMutation.error.message
        : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={routes.pos(shopId)}
        className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to POS
      </Link>

      <PageHeader
        title={`Order #${String(data.orderId).slice(-6).toUpperCase()}`}
        description={`${orderTypeLabel}${
          customerBits ? ` · ${customerBits}` : ""
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={kitchenKey} />
            <Badge
              tone={PAYMENT_STATUS_TONE[data.paymentStatus] ?? "neutral"}
            >
              Pay: {data.paymentStatus}
            </Badge>
            {data.paymentMethod ? (
              <Badge tone="neutral">{data.paymentMethod}</Badge>
            ) : null}
            {!sent ? (
              <Button
                size="sm"
                onClick={() => sendMutation.mutate()}
                loading={sendMutation.isPending}
              >
                <ChefHat className="h-4 w-4" /> Send to kitchen
              </Button>
            ) : (
              <Badge tone="success">In kitchen · {kitchenKey}</Badge>
            )}
          </div>
        }
      />

      {actionError ? <Alert tone="danger" title={actionError} /> : null}

      {!sent ? (
        <Alert
          tone="info"
          title="Not on the kitchen board yet"
          description="Payment is separate from cooking. Send to kitchen when the ticket should appear for prep."
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Item</TableHeaderCell>
                  <TableHeaderCell className="text-right">Qty</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Unit price
                  </TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Line total
                  </TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {(data.items ?? []).map((item, index) => (
                  <TableRow key={`${item.menuItemId}-${index}`}>
                    <TableCell className="font-medium">
                      <div>
                        {item.name}
                        {item.lineType === "combo" ? (
                          <span className="ml-1 text-xs font-normal text-ink-muted">
                            (combo)
                          </span>
                        ) : null}
                      </div>
                      {item.comboSelections &&
                      item.comboSelections.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 border-l-2 border-border pl-3 text-sm font-normal text-ink-muted">
                          {item.comboSelections.map((s, j) => (
                            <li key={`${s.menuItemId}-${j}`}>
                              {s.groupName ? (
                                <span className="text-ink-faint">
                                  {s.groupName}:{" "}
                                </span>
                              ) : null}
                              {s.menuItemName} ×{s.quantity}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-sm font-medium text-ink">Total</span>
              <span className="font-display text-base font-semibold text-ink">
                {formatCurrency(data.totalAmount)}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-ink-muted">
                Status:{" "}
                <span className="font-medium text-ink">
                  {data.paymentStatus}
                </span>
                {data.paymentMethod ? ` · ${data.paymentMethod}` : ""}
              </p>
              {data.paymentStatus !== "paid" ? (
                <Button
                  size="sm"
                  onClick={() => payMutation.mutate("paid")}
                  loading={payMutation.isPending}
                >
                  Mark paid
                </Button>
              ) : (
                <Badge tone="success">Paid</Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderLifecycleTimeline events={data.events ?? []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
