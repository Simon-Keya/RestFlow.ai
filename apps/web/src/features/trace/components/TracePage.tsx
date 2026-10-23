"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { useTrace } from "../hooks/use-trace";
import { TraceSearchForm } from "./TraceSearchForm";
import { TraceTimeline } from "./TraceTimeline";
import { TraceEmptyState } from "./TraceEmptyState";
import { TraceSkeleton } from "./TraceSkeleton";

export function TracePage({ shopId }: { shopId: string }) {
  const { results, search, params } = useTrace(shopId);
  const hasSearched = Object.values(params).some(Boolean);
  const events = Array.isArray(results.data?.items) ? results.data.items : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trace"
        description="Follow every event recorded against an item, batch, or event type."
      />

      <TraceSearchForm onSearch={search} isSearching={results.isFetching} />

      {!hasSearched ? (
        <Card>
          <TraceEmptyState hasSearched={false} />
        </Card>
      ) : results.isPending ? (
        <TraceSkeleton />
      ) : results.isError ? (
        <ErrorState
          title="Couldn't run this search"
          description={results.error.message}
          onRetry={results.refetch}
        />
      ) : events.length === 0 ? (
        <Card>
          <TraceEmptyState hasSearched />
        </Card>
      ) : (
        <TraceTimeline events={events} />
      )}
    </div>
  );
}
