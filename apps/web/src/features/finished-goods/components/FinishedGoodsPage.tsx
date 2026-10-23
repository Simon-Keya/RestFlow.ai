// apps/web/src/features/finished-goods/components/FinishedGoodsPage.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FullPageSpinner } from "@/components/feedback/FullPageSpinner";
import { ProductionHistoryTable } from "@/features/kitchen/components/ProductionHistoryTable";
import { kitchenApi } from "@/features/kitchen/api";

export function FinishedGoodsPage({ shopId }: { shopId: string }) {
  const history = useQuery({
    queryKey: ["kitchen", "production-history", shopId],
    queryFn: () => kitchenApi.getProductionHistory(shopId),
    refetchInterval: 60_000,
  });

  if (history.isPending) {
    return <FullPageSpinner label="Loading finished goods…" />;
  }

  if (history.isError) {
    return (
      <ErrorState
        title="Couldn't load finished goods"
        description={history.error.message}
        onRetry={() => history.refetch()}
      />
    );
  }

  const items = history.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Finished goods"
        description="Production lots by batch — not mixed with raw inventory. Each row is one finished run (production ID)."
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <Package className="h-4 w-4 text-ink-muted" />
            Lots on hand
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {items.length} finished batch{items.length === 1 ? "" : "es"}
          </p>
        </div>
        <ProductionHistoryTable items={items} />
      </Card>
    </div>
  );
}