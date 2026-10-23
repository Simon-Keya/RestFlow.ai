"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { FullPageSpinner } from "@/components/feedback/FullPageSpinner";
import { LineChart } from "@/components/charts/LineChart";
import { formatCurrency } from "@/lib/format/currency";
import { formatPercentValue } from "@/lib/format/percent";
import { routes } from "@/lib/routes";
import { useMenuItemConsumption } from "../hooks/use-menu-item-consumption";
import { PeriodFilter } from "@/features/dashboard/components/PeriodFilter";

export function MenuItemDetailPage({ shopId, menuItemId }: { shopId: string; menuItemId: string }) {
  const { detail, period, setPeriod, setRange } = useMenuItemConsumption(menuItemId);

  if (detail.isPending) return <FullPageSpinner label="Loading menu item performance…" />;
  if (detail.isError) {
    return <ErrorState title="Couldn't load this menu item" description={detail.error.message} onRetry={detail.refetch} />;
  }

  const { data } = detail;

  return (
    <div className="flex flex-col gap-6">
      <Link href={routes.consumption(shopId)} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to consumption
      </Link>

      <PageHeader
        title={data.name}
        description="Sales and food cost performance over the selected period."
        actions={<PeriodFilter value={period} onPresetChange={setPeriod} onRangeChange={setRange} />}
      />

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-ink-muted">Units sold</p>
          <p className="mt-1 font-display text-xl font-semibold text-ink">{data.unitsSold}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-muted">Revenue</p>
          <p className="mt-1 font-display text-xl font-semibold text-ink">{formatCurrency(data.revenue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-muted">Food cost %</p>
          <p className="mt-1 flex items-center gap-2 font-display text-xl font-semibold text-ink">
            {formatPercentValue(data.foodCostPercent)}
            {data.foodCostPercent !== null && Number(data.foodCostPercent) > 35 ? <Badge tone="danger">High</Badge> : null}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Units sold per day</CardTitle>
        </CardHeader>
        <CardContent>
          {data.history.length === 0 ? (
            <p className="text-sm text-ink-muted">No daily breakdown available for this period.</p>
          ) : (
            <LineChart data={data.history} xKey="date" series={[{ key: "unitsSold", color: "hsl(168 62% 34%)", label: "Units sold" }]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
