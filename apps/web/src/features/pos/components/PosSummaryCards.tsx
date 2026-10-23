import { CheckCircle2, Clock, ShoppingBag, XCircle } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import type { PosOrderSummary } from "../types";

export function PosSummaryCards({ orders }: { orders: PosOrderSummary[] }) {
  const pending = orders.filter((o) => o.status === "pending" || o.status === "preparing").length;
  const ready = orders.filter((o) => o.status === "ready").length;
  const served = orders.filter((o) => o.status === "served").length;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="In progress" value={String(pending)} icon={Clock} />
      <StatCard label="Ready for pickup" value={String(ready)} icon={ShoppingBag} />
      <StatCard label="Served" value={String(served)} icon={CheckCircle2} />
      <StatCard label="Cancelled" value={String(cancelled)} icon={XCircle} />
    </div>
  );
}
