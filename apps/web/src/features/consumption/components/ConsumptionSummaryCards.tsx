import { DollarSign, TrendingDown } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatCurrencyCompact } from "@/lib/format/currency";
import { foodCostPercent, foodCostStatus } from "@/lib/kpis/food-cost";
import { formatPercent } from "@/lib/format/percent";
import type { ConsumptionSummary } from "../types";

/**
 * API foodCostPercent is 0–100. foodCostPercent(cogs, revenue) returns 0–1 ratio.
 * Always display via formatPercent(ratio 0–1).
 */
export function ConsumptionSummaryCards({
  summary,
}: {
  summary: ConsumptionSummary;
}) {
  let ratio: number | null = foodCostPercent(
    summary.totalConsumedValue,
    summary.periodRevenue,
  );

  const fromApi = summary.foodCostPercent;
  if (fromApi != null && Number.isFinite(Number(fromApi))) {
    const n = Number(fromApi);
    ratio = n > 1 ? n / 100 : n;
  }

  const status = foodCostStatus(ratio);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <KpiCard
        label="Total consumed value"
        value={formatCurrencyCompact(summary.totalConsumedValue)}
        icon={DollarSign}
      />
      <KpiCard
        label="Consumption as % of revenue"
        value={formatPercent(ratio)}
        icon={TrendingDown}
        tone={
          status === "over"
            ? "danger"
            : status === "watch"
              ? "warning"
              : "success"
        }
      />
    </div>
  );
}
