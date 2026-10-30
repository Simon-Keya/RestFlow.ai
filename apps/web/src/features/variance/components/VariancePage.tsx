"use client";

import Link from "next/link";
import { routes } from "@/lib/routes";

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
    return (
      <ErrorState
        title="Couldn't load variance data"
        description={batches.error.message}
        onRetry={batches.refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Variance"
        description="Stock counts vs. expected quantities, with flagged discrepancies."
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href={routes.stockLedger(shopId)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-primary hover:bg-primary/5"
        >
          Daily Stock Ledger
        </Link>
        <Link
          href={routes.kitchen(shopId) + "/closing-stock"}
          className="rounded-lg border border-border bg-surface px-3 py-2 hover:bg-muted/40"
        >
          Closing stock count
        </Link>
      </div>

      <VarianceSummaryCards batches={batches.data.items} />

      <Card>
        <VarianceBatchesTable shopId={shopId} batches={batches.data.items} />
      </Card>
    </div>
  );
}