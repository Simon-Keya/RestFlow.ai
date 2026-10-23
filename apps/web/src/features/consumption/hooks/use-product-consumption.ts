"use client";

import { useQuery } from "@tanstack/react-query";
import { consumptionApi } from "../api";
import { usePeriodFilter } from "@/features/dashboard/hooks/use-period-filter";

export function useProductConsumption(productId: string) {
  const { period, setPeriod, setRange } = usePeriodFilter();

  const detail = useQuery({
    queryKey: ["consumption", "product", productId, period.from, period.to],
    queryFn: () => consumptionApi.getProductDetail(productId, { from: period.from, to: period.to }),
  });

  return { detail, period, setPeriod, setRange };
}
