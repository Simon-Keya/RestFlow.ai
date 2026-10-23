import { DollarSign, PieChart, Repeat, Target } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatPercentValue } from "@/lib/format/percent";
import { formatCurrencyCompact } from "@/lib/format/currency";
import { foodCostStatus } from "@/lib/kpis/food-cost";
import type { DashboardKpis } from "../types";

export function KpiRow({ kpis }: { kpis: DashboardKpis }) {
  // API returns 0–100 style percents (e.g. 28.5), not 0–1 ratios
  const foodCostTone = foodCostStatus(
    kpis.foodCostPercent != null ? kpis.foodCostPercent / 100 : null,
  );

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KpiCard
        label="Food cost %"
        value={formatPercentValue(kpis.foodCostPercent)}
        icon={PieChart}
        tone={
          foodCostTone === "over"
            ? "danger"
            : foodCostTone === "watch"
              ? "warning"
              : "success"
        }
      />
      <KpiCard
        label="Gross margin"
        value={formatPercentValue(kpis.grossMarginPercent)}
        icon={Target}
        tone="neutral"
      />
      <KpiCard
        label="Inventory turnover"
        value={
          kpis.inventoryTurnover !== null
            ? `${kpis.inventoryTurnover.toFixed(1)}x`
            : "—"
        }
        icon={Repeat}
      />
      <KpiCard
        label="Waste value"
        value={formatCurrencyCompact(kpis.wasteValue)}
        icon={DollarSign}
        tone="warning"
      />
    </div>
  );
}
