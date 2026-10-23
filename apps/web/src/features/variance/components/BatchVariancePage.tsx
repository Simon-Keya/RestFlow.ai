"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FullPageSpinner } from "@/components/feedback/FullPageSpinner";
import { formatDateTime } from "@/lib/format/dates";
import { routes } from "@/lib/routes";
import { useBatchVariance } from "../hooks/use-batch-variance";
import { IngredientVarianceTable } from "./IngredientVarianceTable";
import { ReasonCodeForm } from "./ReasonCodeForm";
import { VarianceFlagBadge } from "./VarianceFlagBadge";
import { useToast } from "@/providers/ToastProvider";

export function BatchVariancePage({ shopId, batchId }: { shopId: string; batchId: string }) {
  const { batch, submitReasonCode } = useBatchVariance(batchId);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const { toast } = useToast();

  if (batch.isPending) return <FullPageSpinner label="Loading variance batch…" />;
  if (batch.isError) {
    return <ErrorState title="Couldn't load this batch" description={batch.error.message} onRetry={batch.refetch} />;
  }

  const { data } = batch;
  const activeLine = data.lines.find((l) => l.itemId === activeLineId);
  const flaggedLines = data.lines.filter((l) => Math.abs(l.varianceQuantity) > 0 && !l.reasonCode);

  return (
    <div className="flex flex-col gap-6">
      <Link href={routes.variance(shopId)} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to variance
      </Link>

      <PageHeader
        title={`Batch #${data.batchId.slice(-6).toUpperCase()}`}
        description={`Counted by ${data.countedBy} · ${formatDateTime(data.countedAt)}`}
        actions={<VarianceFlagBadge status={data.status} />}
      />

      {flaggedLines.length > 0 ? (
        <Card className="p-4">
          <p className="text-sm text-ink-muted">
            {flaggedLines.length} line{flaggedLines.length === 1 ? "" : "s"} still need a reason code. Click a row below to explain it.
          </p>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ingredient-level variance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <IngredientVarianceTable lines={data.lines} onSelectLine={setActiveLineId} />
        </CardContent>
      </Card>

      {activeLine ? (
        <ReasonCodeForm
          line={activeLine}
          isSubmitting={submitReasonCode.isPending}
          error={submitReasonCode.error}
          onSubmit={(input) =>
            submitReasonCode.mutate(input, {
              onSuccess: () => {
                toast({ title: "Reason saved", variant: "success" });
                setActiveLineId(null);
              },
            })
          }
        />
      ) : null}
    </div>
  );
}
