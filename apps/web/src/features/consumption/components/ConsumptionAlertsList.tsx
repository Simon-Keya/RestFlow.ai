import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/format/dates";
import { CONSUMPTION_ALERT_LABELS } from "../constants";
import type { ConsumptionAlert } from "../types";

const TONE: Record<ConsumptionAlert["type"], "warning" | "danger"> = {
  unusual_spike: "warning",
  unusual_drop: "warning",
  negative_margin: "danger",
  high_food_cost: "danger",
};

export function ConsumptionAlertsList({ alerts }: { alerts: ConsumptionAlert[] }) {
  if (alerts.length === 0) {
    return <EmptyState icon={AlertTriangle} title="No consumption anomalies" description="You'll see unusual spikes, drops, or negative-margin items here." />;
  }

  return (
    <ul className="divide-y divide-border">
      {alerts.map((alert) => (
        <li key={alert.id} className="flex items-start justify-between gap-3 px-5 py-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone={TONE[alert.type]}>{CONSUMPTION_ALERT_LABELS[alert.type]}</Badge>
              <p className="text-sm font-medium text-ink">{alert.itemName}</p>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{alert.message}</p>
          </div>
          <span className="shrink-0 text-xs text-ink-faint">{formatRelativeTime(alert.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
