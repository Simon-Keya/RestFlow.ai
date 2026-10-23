import { AlertOctagon, ClipboardCheck, Percent } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatCurrencyCompact } from "@/lib/format/currency";
import type { VarianceBatch } from "../types";

export function VarianceSummaryCards({ batches }: { batches: VarianceBatch[] }) {
  const flagged = batches.filter((b) => b.status === "flagged").length;
  const totalVarianceValue = batches.reduce((sum, b) => sum + b.totalVarianceValue, 0);
  const avgFlaggedRate =
    batches.length > 0
      ? batches.reduce((sum, b) => sum + (b.itemsCounted > 0 ? b.itemsFlagged / b.itemsCounted : 0), 0) / batches.length
      : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard label="Flagged batches" value={String(flagged)} icon={AlertOctagon} tone={flagged > 0 ? "danger" : "success"} />
      <KpiCard label="Total variance value" value={formatCurrencyCompact(totalVarianceValue)} icon={ClipboardCheck} tone="warning" />
      <KpiCard label="Avg. flagged rate" value={`${(avgFlaggedRate * 100).toFixed(1)}%`} icon={Percent} />
    </div>
  );
}
