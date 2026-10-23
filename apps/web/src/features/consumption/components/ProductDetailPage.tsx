"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FullPageSpinner } from "@/components/feedback/FullPageSpinner";
import { LineChart } from "@/components/charts/LineChart";
import { formatCurrency } from "@/lib/format/currency";
import { formatQuantity } from "@/lib/format/numbers";
import { formatNumber } from "@/lib/format/numbers";
import { routes } from "@/lib/routes";
import { useProductConsumption } from "../hooks/use-product-consumption";
import { PeriodFilter } from "@/features/dashboard/components/PeriodFilter";

export function ProductDetailPage({ shopId, productId }: { shopId: string; productId: string }) {
  const { detail, period, setPeriod, setRange } = useProductConsumption(productId);

  if (detail.isPending) return <FullPageSpinner label="Loading product consumption…" />;
  if (detail.isError) {
    return <ErrorState title="Couldn't load this product" description={detail.error.message} onRetry={detail.refetch} />;
  }

  const { data } = detail;

  return (
    <div className="flex flex-col gap-6">
      <Link href={routes.consumption(shopId)} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to consumption
      </Link>

      <PageHeader
        title={data.name}
        description="Consumption trend over the selected period."
        actions={<PeriodFilter value={period} onPresetChange={setPeriod} onRangeChange={setRange} />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs text-ink-muted">Total quantity consumed</p>
          <p className="mt-1 font-display text-xl font-semibold text-ink">{formatQuantity(data.quantityConsumed, data.unit)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-muted">Total value consumed</p>
          <p className="mt-1 font-display text-xl font-semibold text-ink">{formatCurrency(data.valueConsumed)}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily usage</CardTitle>
        </CardHeader>
        <CardContent>
          {data.history.length === 0 ? (
            <p className="text-sm text-ink-muted">No daily breakdown available for this period.</p>
          ) : (
            <LineChart
              data={data.history}
              xKey="date"
              series={[{ key: "quantity", color: "hsl(168 62% 34%)", label: "Quantity" }]}
              valueFormatter={(v) => formatNumber(v)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
