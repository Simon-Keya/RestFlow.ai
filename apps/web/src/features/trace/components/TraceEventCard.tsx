"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format/dates";
import { formatQuantity } from "@/lib/format/numbers";
import { humanize } from "@/lib/utils";
import { cn } from "@/lib/cn";
import type { TraceEvent } from "../types";

export function TraceEventCard({ event }: { event: TraceEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <Badge tone="primary">{humanize(event.eventType)}</Badge>
          <div>
            <p className="text-sm text-ink">
              {event.itemName ?? event.itemId ?? "—"}
              {event.batchNumber ? <span className="text-ink-faint"> · batch {event.batchNumber}</span> : null}
            </p>
            <p className="text-xs text-ink-faint">
              {formatDateTime(event.createdAt)}
              {event.actor ? ` · ${event.actor}` : ""}
              {event.quantity !== null && event.quantity !== undefined ? ` · ${formatQuantity(event.quantity, "units")}` : ""}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-ink-faint" /> : <ChevronDown className="h-4 w-4 text-ink-faint" />}
      </button>
      <div className={cn("overflow-hidden transition-all", expanded ? "max-h-96" : "max-h-0")}>
        <pre className="overflow-x-auto border-t border-border bg-surface-muted/60 px-4 py-3 text-xs text-ink-muted">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}
