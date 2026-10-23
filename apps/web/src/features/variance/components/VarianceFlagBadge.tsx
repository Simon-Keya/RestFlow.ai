import { Badge } from "@/components/ui/Badge";
import { VARIANCE_STATUS_LABELS } from "../constants";

const TONE: Record<string, "neutral" | "warning" | "danger"> = {
  open: "neutral",
  reviewed: "neutral",
  flagged: "danger",
};

export function VarianceFlagBadge({ status }: { status: string }) {
  return <Badge tone={TONE[status] ?? "neutral"}>{VARIANCE_STATUS_LABELS[status] ?? status}</Badge>;
}
