"use client";

import { useQuery } from "@tanstack/react-query";
import { consumptionApi } from "../api";

export function useConsumptionAlerts(shopId: string) {
  return useQuery({
    queryKey: ["consumption", "alerts", shopId],
    queryFn: () => consumptionApi.getAlerts(shopId),
    refetchInterval: 120_000,
  });
}
