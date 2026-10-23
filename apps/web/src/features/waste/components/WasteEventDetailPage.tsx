"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { FullPageSpinner } from "@/components/feedback/FullPageSpinner";
import { WasteCauseBadge } from "./WasteCauseBadge";
import { formatCurrency } from "@/lib/format/currency";
import { formatQuantity } from "@/lib/format/numbers";
import { formatDateTime } from "@/lib/format/dates";
import { routes } from "@/lib/routes";
import { useWasteEvent } from "../hooks/use-waste-event";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="mt-1 text-sm text-ink">{value ?? "—"}</p>
    </div>
  );
}

export function WasteEventDetailPage({
  shopId,
  eventId,
}: {
  shopId: string;
  eventId: string;
}) {
  const event = useWasteEvent(eventId);

  if (event.isPending) return <FullPageSpinner label="Loading waste event…" />;
  if (event.isError) {
    return (
      <ErrorState
        title="Couldn't load this event"
        description={event.error.message}
        onRetry={event.refetch}
      />
    );
  }

  const { data } = event;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={routes.waste(shopId)}
        className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to waste
      </Link>

      <PageHeader
        title={data.itemName}
        description={`Reported ${formatDateTime(data.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WasteCauseBadge cause={data.cause} />
            <Button variant="secondary" size="sm" asChild>
              <Link
                href={routes.traceSearch(shopId, {
                  itemId: data.itemId || undefined,
                  batchNumber: data.batchNumber || undefined,
                  eventType: "waste_recorded",
                })}
              >
                <Search className="h-3.5 w-3.5" /> Trace
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
          <Field
            label="Quantity"
            value={formatQuantity(data.quantity, data.unit)}
          />
          <Field label="Value" value={formatCurrency(data.value)} />
          <Field label="Batch" value={data.batchNumber || "—"} />
          <Field label="Reported by" value={data.reportedBy} />
          <Field label="Source module" value={data.moduleSource} />
        </CardContent>
      </Card>

      {data.notes ? (
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Notes
          </p>
          <p className="mt-1 text-sm text-ink">{data.notes}</p>
        </Card>
      ) : null}

      {data.photoUrl ? (
        <Card className="overflow-hidden p-2">
          <Image
            src={data.photoUrl}
            alt="Waste evidence photo"
            width={640}
            height={480}
            className="w-full rounded"
          />
        </Card>
      ) : null}
    </div>
  );
}