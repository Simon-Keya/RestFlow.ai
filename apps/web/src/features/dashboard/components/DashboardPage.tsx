"use client";

import { useShopSummary } from "../hooks/use-shop-summary";
import { useShopKpis } from "../hooks/use-shop-kpis";
import { usePeriodFilter } from "../hooks/use-period-filter";
import { usePendingApprovals } from "@/features/approvals/hooks/use-pending-approvals";
import { dashboardApi } from "../api";
import { useQuery } from "@tanstack/react-query";
import { PERIOD_PRESETS } from "@/lib/constants/period";

import { PageHeader } from "@/components/layout/PageHeader";
import { SummaryCards } from "./SummaryCards";
import { KpiRow } from "./KpiRow";
import { AlertsPanel } from "./AlertsPanel";
import { PendingApprovalsCard } from "./PendingApprovalsCard";
import { QuickLinks } from "./QuickLinks";
import { PeriodFilter } from "./PeriodFilter";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";

export function DashboardPage({ shopId }: { shopId: string }) {
  const { period, setPeriod, setRange } = usePeriodFilter("today");

  const summary = useShopSummary(shopId, period);
  const kpis = useShopKpis(shopId, period);
  const approvals = usePendingApprovals(shopId);
  const alerts = useQuery({
    queryKey: ["dashboard", "alerts", shopId],
    queryFn: () => dashboardApi.getAlerts(shopId),
    refetchInterval: 60_000,
  });

  const periodLabel =
    PERIOD_PRESETS.find((p) => p.value === period.preset)?.label ??
    `${period.from} → ${period.to}`;

  if (summary.isPending) return <DashboardSkeleton />;

  if (summary.isError) {
    return (
      <ErrorState
        title="Couldn't load the dashboard"
        description={summary.error.message}
        onRetry={summary.refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome back — ${summary.data.shopName}`}
        description="Revenue and orders follow the selected period."
        actions={
          <PeriodFilter
            value={period}
            onPresetChange={setPeriod}
            onRangeChange={setRange}
          />
        }
      />

      <SummaryCards summary={summary.data} periodLabel={periodLabel} />

      <QuickLinks shopId={shopId} />

      {kpis.data ? <KpiRow kpis={kpis.data} /> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AlertsPanel alerts={alerts.data ?? []} />
        <PendingApprovalsCard
          shopId={shopId}
          approvals={approvals.data ?? []}
        />
      </div>
    </div>
  );
}
