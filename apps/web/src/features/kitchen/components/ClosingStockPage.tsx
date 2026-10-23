"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FullPageSpinner } from "@/components/feedback/FullPageSpinner";
import { Alert } from "@/components/ui/Alert";
import { ClosingStockForm } from "./ClosingStockForm";
import { useClosingStock } from "../hooks/use-closing-stock";
import { useAuthStore } from "@/store/auth";
import { canSubmitClosingStock } from "@/lib/permissions";
import { routes } from "@/lib/routes";

export function ClosingStockPage({ shopId }: { shopId: string }) {
  const role = useAuthStore((s) => s.user?.role);
  const canSubmit = canSubmitClosingStock(role);
  const { form, submit } = useClosingStock(shopId);

  if (form.isLoading) {
    return <FullPageSpinner label="Loading closing stock…" />;
  }

  if (form.isError) {
    return (
      <ErrorState
        title="Could not load closing stock"
        description={
          form.error instanceof Error
            ? form.error.message
            : "Try again shortly."
        }
        onRetry={() => form.refetch()}
      />
    );
  }

  const entries = form.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href={routes.kitchen(shopId)}
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Kitchen
        </Link>
      </div>

      <PageHeader
        title="Closing stock count"
        description="Enter physical counts against system quantities. Submitting creates a reconciliation event for inventory accuracy and variance."
      />

      {!canSubmit ? (
        <Alert
          tone="warning"
          title="View only"
          description="Only administrators and managers can submit closing stock. You can review expected quantities, but finalization is restricted."
        />
      ) : null}

      <Card className="p-4">
        <ClosingStockForm
          entries={entries}
          onSubmit={(submission) => submit.mutate(submission)}
          isSubmitting={submit.isPending}
          error={submit.error}
          canSubmit={canSubmit}
        />
      </Card>
    </div>
  );
}
