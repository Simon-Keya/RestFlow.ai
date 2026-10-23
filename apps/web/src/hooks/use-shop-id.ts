"use client";

import { useParams } from "next/navigation";

/** Reads `shopId` from the `[shopId]` route segment. Throws outside a shop-scoped route on purpose — every dashboard screen needs it. */
export function useShopId(): string {
  const params = useParams<{ shopId: string }>();
  if (!params?.shopId) {
    throw new Error("useShopId() called outside a /shop/[shopId] route");
  }
  return params.shopId;
}
