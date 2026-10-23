import { Alert } from "@/components/ui/Alert";
import type { InventoryItem } from "../types";

export function LowStockBanner({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) return null;
  const names = items.slice(0, 3).map((i) => i.name).join(", ");
  const extra = items.length > 3 ? ` and ${items.length - 3} more` : "";
  return (
    <Alert
      tone="warning"
      title={`${items.length} item${items.length === 1 ? "" : "s"} below reorder point`}
      description={`${names}${extra}. Consider placing a purchase order.`}
    />
  );
}
