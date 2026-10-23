"use client";

import { useQuery } from "@tanstack/react-query";
import { traceApi } from "../api";

export function useItemTrace(itemId: string, shopId: string) {
  return useQuery({
    queryKey: ["trace", "item", itemId, shopId],
    queryFn: () => traceApi.getForItem(itemId, shopId),
    enabled: Boolean(itemId),
  });
}
