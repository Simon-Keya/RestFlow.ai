import { TraceEventCard } from "./TraceEventCard";
import type { TraceEvent } from "../types";

export function TraceTimeline({ events }: { events: TraceEvent[] }) {
  const list = Array.isArray(events) ? events : [];

  return (
    <div className="flex flex-col gap-2">
      {list.map((event) => (
        <TraceEventCard key={event.id} event={event} />
      ))}
    </div>
  );
}