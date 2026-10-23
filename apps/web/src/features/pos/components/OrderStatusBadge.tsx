import { Badge } from "@/components/ui/Badge";
import { humanize } from "@/lib/utils";
import { ORDER_STATUS_TONE } from "../constants";

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge tone={ORDER_STATUS_TONE[status] ?? "neutral"}>{humanize(status)}</Badge>;
}
