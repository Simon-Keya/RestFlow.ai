import { Badge } from "@/components/ui/Badge";
import { WASTE_CAUSE_LABELS } from "../constants";
import type { WasteCause } from "../types";

const TONE: Record<WasteCause, "neutral" | "warning" | "danger"> = {
  expired: "danger",
  spoiled: "danger",
  prep_error: "warning",
  customer_return: "neutral",
  overproduction: "warning",
  other: "neutral",
};

export function WasteCauseBadge({ cause }: { cause: WasteCause }) {
  return <Badge tone={TONE[cause]}>{WASTE_CAUSE_LABELS[cause]}</Badge>;
}
