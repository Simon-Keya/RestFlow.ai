"use client";

import { Store } from "lucide-react";
import { useShopId } from "@/hooks/use-shop-id";

/** Small persistent reminder of which shop's data is on screen — important once multi-shop is real (see the audit note on hardcoded shop_id upstream). */
export function ShopContextBadge() {
  const shopId = useShopId();
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2.5 py-1 text-xs text-ink-muted">
      <Store className="h-3.5 w-3.5" aria-hidden />
      <span>Shop {shopId}</span>
    </div>
  );
}
