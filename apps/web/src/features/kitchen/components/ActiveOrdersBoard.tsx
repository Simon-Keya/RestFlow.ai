"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/ToastProvider";
import { kitchenApi } from "../api";
import type { ActiveOrder } from "../types";
import { ChefHat } from "lucide-react";

const NEXT: Record<
  string,
  { status: string; label: string } | null
> = {
  pending: { status: "preparing", label: "Start preparing" },
  preparing: { status: "ready", label: "Mark ready" },
  ready: { status: "completed", label: "Complete" },
  served: null,
  cancelled: null,
};

export function ActiveOrdersBoard({
  shopId,
  orders,
}: {
  shopId: string;
  orders: ActiveOrder[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: string;
      status: string;
    }) => kitchenApi.updateOrderStatus(orderId, status),
    onSuccess: () => {
      toast({ title: "Order updated", variant: "success" });
      void queryClient.invalidateQueries({
        queryKey: ["kitchen", "active-orders", shopId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["kitchen", "dashboard", shopId],
      });
    },
    onError: (err) => {
      toast({
        title:
          err instanceof ApiError ? err.message : "Could not update order",
        variant: "danger",
      });
    },
  });

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={ChefHat}
        title="No active orders"
        description="Paid POS orders show up here until completed."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {orders.map((order) => {
        const next = NEXT[order.status] ?? null;
        return (
          <Card key={order.orderId}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">
                  #{order.orderId.slice(-6).toUpperCase()}
                </CardTitle>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {order.orderType.replace(/_/g, " ")}
                  {order.tableNumber ? ` · Table ${order.tableNumber}` : ""}
                </p>
              </div>
              <Badge
                tone={
                  order.status === "ready"
                    ? "success"
                    : order.status === "preparing"
                      ? "warning"
                      : "neutral"
                }
              >
                {order.status}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ul className="space-y-2 text-sm">
                {order.items.map((it, i) => (
                  <li key={`${it.menuItemId}-${i}`} className="text-ink">
                    <div>
                      <span className="font-medium">{it.quantity}×</span>{" "}
                      {it.name}
                      {it.lineType === "combo" ? (
                        <span className="ml-1 text-xs text-ink-muted">
                          (combo)
                        </span>
                      ) : null}
                      {it.notes ? (
                        <span className="text-ink-muted"> — {it.notes}</span>
                      ) : null}
                    </div>
                    {it.selections && it.selections.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 border-l-2 border-border pl-3 text-ink-muted">
                        {it.selections.map((s, j) => (
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
                    ) : it.lineType === "combo" ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Combo — no line picks on this ticket. After API deploy,
                        re-send from POS or place a new order.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {next ? (
                <Button
                  size="sm"
                  disabled={mutation.isPending}
                  loading={
                    mutation.isPending &&
                    mutation.variables?.orderId === order.orderId
                  }
                  onClick={() =>
                    mutation.mutate({
                      orderId: order.orderId,
                      status: next.status,
                    })
                  }
                >
                  {next.label}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}