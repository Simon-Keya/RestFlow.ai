"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useConsumptionDashboard } from "../hooks/use-consumption-dashboard";
import { ConsumptionSummaryCards } from "./ConsumptionSummaryCards";
import { ConsumptionBreakdownChart } from "./ConsumptionBreakdownChart";
import { TopProductsTable } from "./TopProductsTable";
import { TopMenuItemsTable } from "./TopMenuItemsTable";
import { ConsumptionSkeleton } from "./ConsumptionSkeleton";
import { PeriodFilter } from "@/features/dashboard/components/PeriodFilter";
import { routes } from "@/lib/routes";

export function ConsumptionPage({ shopId }: { shopId: string }) {
  const { summary, period, setPeriod, setRange } = useConsumptionDashboard(shopId);

  if (summary.isPending) return <ConsumptionSkeleton />;
  if (summary.isError) {
    return <ErrorState title="Couldn't load consumption data" description={summary.error.message} onRetry={summary.refetch} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Consumption"
        description="What's being used, and how it's tracking against sales."
        actions={
          <div className="flex items-center gap-2">
            <PeriodFilter value={period} onPresetChange={setPeriod} onRangeChange={setRange} />
            <Button asChild variant="secondary">
              <Link href={routes.consumptionAlerts(shopId)}>
                <AlertTriangle className="h-4 w-4" /> Alerts
              </Link>
            </Button>
          </div>
        }
      />

      <ConsumptionSummaryCards summary={summary.data} />

      <ConsumptionBreakdownChart products={summary.data.topProducts} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopProductsTable shopId={shopId} products={summary.data.topProducts} />
        <TopMenuItemsTable shopId={shopId} items={summary.data.topMenuItems} />
      </div>
    </div>
  );
}
