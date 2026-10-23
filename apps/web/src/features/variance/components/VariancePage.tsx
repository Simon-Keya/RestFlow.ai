"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { useVarianceDashboard } from "../hooks/use-variance-dashboard";
import { VarianceSummaryCards } from "./VarianceSummaryCards";
import { VarianceBatchesTable } from "./VarianceBatchesTable";
import { VarianceSkeleton } from "./VarianceSkeleton";

export function VariancePage({ shopId }: { shopId: string }) {
  const { batches } = useVarianceDashboard(shopId);

  if (batches.isPending) return <VarianceSkeleton />;
  if (batches.isError) {
    return <ErrorState title="Couldn't load variance data" description={batches.error.message} onRetry={batches.refetch} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Variance" description="Stock counts vs. expected quantities, with flagged discrepancies." />

      <VarianceSummaryCards batches={batches.data.items} />

      <Card>
        <VarianceBatchesTable shopId={shopId} batches={batches.data.items} />
      </Card>
    </div>
  );
}
