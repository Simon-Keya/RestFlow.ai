// apps/web/src/features/pos/components/PosPage.tsx
"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { ErrorState } from "@/components/ui/ErrorState";
import { usePosDashboard } from "../hooks/use-pos-dashboard";
import { PosSummaryCards } from "./PosSummaryCards";
import { MenuAvailabilityBar } from "./MenuAvailabilityBar";
import { RecentOrdersTable } from "./RecentOrdersTable";
import { PosSkeleton } from "./PosSkeleton";
import { NewOrderPanel } from "./NewOrderPanel";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "served", label: "Served" },
  { value: "cancelled", label: "Cancelled" },
];

export function PosPage({ shopId }: { shopId: string }) {
  const { orders, menuAvailability, status, setStatus } =
    usePosDashboard(shopId);

  if (orders.isPending) return <PosSkeleton />;
  if (orders.isError) {
    return (
      <ErrorState
        title="Couldn't load orders"
        description={orders.error.message}
        onRetry={orders.refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Point of sale"
        description="Live orders across dine-in, takeaway, and delivery."
        actions={<NewOrderPanel shopId={shopId} />}
      />

      <PosSummaryCards orders={orders.data.items} />

      <MenuAvailabilityBar items={menuAvailability.data ?? []} />

      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <p className="text-sm font-medium text-ink">Recent orders</p>
          <Select
            value={status ?? "all"}
            onValueChange={(v) => setStatus(v === "all" ? "" : v)}
            options={STATUS_OPTIONS}
            className="w-40"
          />
        </div>
        <RecentOrdersTable shopId={shopId} orders={orders.data.items} />
      </Card>
    </div>
  );
}
