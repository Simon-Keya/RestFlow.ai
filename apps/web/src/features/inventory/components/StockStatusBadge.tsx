import { Badge } from "@/components/ui/Badge";
import type { StockStatus } from "../types";

const CONFIG: Record<StockStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  in_stock: { label: "In stock", tone: "success" },
  low_stock: { label: "Low stock", tone: "warning" },
  out_of_stock: { label: "Out of stock", tone: "danger" },
  near_expiry: { label: "Near expiry", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const config = CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
