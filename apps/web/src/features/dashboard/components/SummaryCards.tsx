import { AlertTriangle, Boxes, ClipboardList, ShoppingCart } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { formatCurrency } from "@/lib/format/currency";
import { formatNumber } from "@/lib/format/numbers";
import type { ShopSummary } from "../types";

export function SummaryCards({
  summary,
  periodLabel = "Selected period",
}: {
  summary: ShopSummary;
  periodLabel?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard
        label={`Revenue · ${periodLabel}`}
        value={formatCurrency(summary.todayRevenue)}
        icon={ShoppingCart}
      />
      <StatCard
        label={`Orders · ${periodLabel}`}
        value={formatNumber(summary.todayOrders)}
        icon={ClipboardList}
        helpText={
          summary.averageOrderValue != null && summary.averageOrderValue > 0
            ? `AOV ${formatCurrency(summary.averageOrderValue)}`
            : undefined
        }
      />
      <StatCard
        label="Low stock items"
        value={formatNumber(summary.lowStockCount)}
        icon={Boxes}
        helpText={
          summary.lowStockCount > 0 ? "Needs reordering" : "All stocked"
        }
      />
      <StatCard
        label="Open approvals"
        value={formatNumber(summary.openApprovals)}
        icon={AlertTriangle}
        helpText={
          summary.openApprovals > 0 ? "Awaiting review" : "Nothing pending"
        }
      />
    </div>
  );
}
