"use client";

import { useQuery } from "@tanstack/react-query";
import { consumptionApi } from "../api";
import { usePeriodFilter } from "@/features/dashboard/hooks/use-period-filter";

export function useConsumptionDashboard(shopId: string) {
  const { period, setPeriod, setRange } = usePeriodFilter();

  const summary = useQuery({
    queryKey: ["consumption", "summary", shopId, period.from, period.to],
    queryFn: () => consumptionApi.getSummary(shopId, { from: period.from, to: period.to }),
  });

  return { summary, period, setPeriod, setRange };
}
