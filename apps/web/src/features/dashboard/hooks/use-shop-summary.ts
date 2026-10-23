"use client";

import { useQuery } from "@tanstack/react-query";
import { readAuthTokenClient } from "@/lib/auth/token";

function hasAuthToken(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(readAuthTokenClient());
}

import { dashboardApi } from "../api";
import type { PeriodRange } from "@/lib/constants/period";

export function useShopSummary(shopId: string, period?: PeriodRange) {
  return useQuery({
    queryKey: [
      "dashboard",
      "summary",
      shopId,
      period?.from ?? "today",
      period?.to ?? "today",
    ],
    queryFn: () =>
      dashboardApi.getSummary(shopId, {
        from: period?.from,
        to: period?.to,
      }),
    enabled: hasAuthToken(),
    refetchInterval: 60_000,
  });
}
