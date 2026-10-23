"use client";

import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "../api";

export function useInventoryAlerts(shopId: string) {
  return useQuery({
    queryKey: ["inventory", "alerts", shopId],
    queryFn: () => inventoryApi.getAlerts(shopId),
    refetchInterval: 120_000,
  });
}
