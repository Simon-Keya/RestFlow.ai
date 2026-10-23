import { DollarSign, PackageMinus, Percent } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatCurrencyCompact } from "@/lib/format/currency";
import { formatNumber } from "@/lib/format/numbers";
import { formatPercent } from "@/lib/format/percent";
import type { WasteSummary } from "../types";

export function WasteSummaryCards({ summary }: { summary: WasteSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard label="Total waste value" value={formatCurrencyCompact(summary.totalWastedValue)} icon={DollarSign} tone="danger" />
      <KpiCard label="Total waste quantity" value={formatNumber(summary.totalWastedQuantity)} icon={PackageMinus} />
      <KpiCard label="Waste % of purchases" value={formatPercent(summary.wastePercentOfPurchases)} icon={Percent} tone="warning" />
    </div>
  );
}
