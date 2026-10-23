// apps/web/src/features/kitchen/components/KitchenSummaryCards.tsx
import { ChefHat, Clock, PackageCheck, RefreshCcw } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import type { ActiveOrder, ProductionQueueItem } from "../types";

export function KitchenSummaryCards({
  orders,
  queue,
  pendingRefills = 0,
}: {
  orders?: ActiveOrder[] | null;
  queue?: ProductionQueueItem[] | null;
  pendingRefills?: number;
}) {
  const orderList = Array.isArray(orders) ? orders : [];
  const queueList = Array.isArray(queue) ? queue : [];

  const preparing = orderList.filter((o) => o.status === "preparing").length;
  const ready = orderList.filter((o) => o.status === "ready").length;
  const inProduction = queueList.filter((q) =>
    ["started", "preparing"].includes(q.status),
  ).length;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard
        label="Orders preparing"
        value={String(preparing)}
        icon={ChefHat}
      />
      <StatCard
        label="Orders ready"
        value={String(ready)}
        icon={PackageCheck}
      />
      <StatCard
        label="Batches in production"
        value={String(inProduction)}
        icon={Clock}
      />
      <StatCard
        label="Pending refills"
        value={String(pendingRefills ?? 0)}
        icon={RefreshCcw}
      />
    </div>
  );
}
