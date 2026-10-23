// apps/web/src/features/dashboard/hooks/use-shop-kpis.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { readAuthTokenClient } from "@/lib/auth/token";
import { dashboardApi } from "../api";
import type { PeriodRange } from "@/lib/constants/period";

function hasAuthToken(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(readAuthTokenClient());
}

export function useShopKpis(shopId: string, period: PeriodRange) {
  return useQuery({
    queryKey: ["dashboard", "kpis", shopId, period.from, period.to],
    queryFn: () =>
      dashboardApi.getKpis(shopId, { from: period.from, to: period.to }),
    enabled: hasAuthToken(),
  });
}