"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatQuantity } from "@/lib/format/numbers";
import { formatRelativeTime } from "@/lib/format/dates";
import { RefreshCcw } from "lucide-react";

export interface PendingRefill {
  requestId: string;
  itemId?: string;
  itemName: string;
  quantity: number;
  unit: string;
  status?: string;
  source?: string;
  requestedBy: string;
  requestedAt: string;
}

/**
 * List CTA is View → opens form (qty, unit cost, expiry).
 * Actual issue happens only after Confirm inside the drawer.
 */
export function RefillPendingList({
  refills,
  onOpen,
}: {
  refills: PendingRefill[];
  onOpen: (requestId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending refill requests</CardTitle>
        <p className="mt-1 text-xs text-ink-muted">
          Requests from kitchen/mobile land here. Open <strong>View</strong>,
          confirm qty / unit cost / batch, then issue stock into inventory.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {refills.length === 0 ? (
          <EmptyState
            icon={RefreshCcw}
            title="No pending refills"
            description="When staff request a refill (or low-stock suggestions appear), they show here until you issue them."
          />
        ) : (
          <ul className="divide-y divide-border">
            {refills.map((refill) => (
              <li
                key={refill.requestId}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {formatQuantity(refill.quantity, refill.unit)} —{" "}
                    {refill.itemName}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {refill.requestedBy} ·{" "}
                    {formatRelativeTime(refill.requestedAt)}
                    {refill.status ? ` · ${refill.status}` : ""}
                  </p>
                  {refill.source === "low_stock" ? (
                    <Badge tone="warning" className="mt-1">
                      System suggestion
                    </Badge>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onOpen(refill.requestId)}
                >
                  View
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}