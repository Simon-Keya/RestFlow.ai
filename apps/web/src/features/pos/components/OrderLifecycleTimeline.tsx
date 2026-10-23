import { Check } from "lucide-react";
import { formatDateTime } from "@/lib/format/dates";
import { humanize } from "@/lib/utils";
import { cn } from "@/lib/cn";
import type { OrderLifecycleEvent } from "../types";

export function OrderLifecycleTimeline({ events }: { events: OrderLifecycleEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-ink-muted">No status history recorded for this order yet.</p>;
  }

  return (
    <ol className="relative ml-2 flex flex-col gap-5 border-l border-border pl-5">
      {events.map((event, index) => (
        <li key={`${event.status}-${event.timestamp}`} className="relative">
          <span
            className={cn(
              "absolute -left-[26px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-surface",
              index === events.length - 1 ? "bg-primary-600" : "bg-success-500",
            )}
          >
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
          </span>
          <p className="text-sm font-medium text-ink">{humanize(event.status)}</p>
          <p className="text-xs text-ink-faint">
            {formatDateTime(event.timestamp)}
            {event.actor ? ` · ${event.actor}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
