import { Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export function TraceEmptyState({ hasSearched }: { hasSearched: boolean }) {
  return (
    <EmptyState
      icon={Search}
      title={hasSearched ? "No events match your search" : "Search for an item, batch, or event type"}
      description={
        hasSearched
          ? "Try widening the date range or clearing a filter."
          : "Trace follows every event recorded against a piece of inventory — receiving, production, sales, waste, and adjustments — in order."
      }
    />
  );
}
