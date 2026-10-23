"use client";

import { useQuery } from "@tanstack/react-query";
import { consumptionApi } from "../api";
import { usePeriodFilter } from "@/features/dashboard/hooks/use-period-filter";

export function useMenuItemConsumption(menuItemId: string) {
  const { period, setPeriod, setRange } = usePeriodFilter();

  const detail = useQuery({
    queryKey: ["consumption", "menu-item", menuItemId, period.from, period.to],
    queryFn: () => consumptionApi.getMenuItemDetail(menuItemId, { from: period.from, to: period.to }),
  });

  return { detail, period, setPeriod, setRange };
}
