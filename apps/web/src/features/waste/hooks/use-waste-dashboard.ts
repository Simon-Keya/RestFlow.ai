// apps/web/src/features/waste/hooks/use-waste-dashboard.ts
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { wasteApi } from "../api";
import { usePeriodFilter } from "@/features/dashboard/hooks/use-period-filter";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants/config";

export function useWasteDashboard(shopId: string) {
  const { period, setPeriod, setRange } = usePeriodFilter();
  const [page, setPage] = useState(1);

  const summary = useQuery({
    queryKey: ["waste", "summary", shopId, period.from, period.to],
    queryFn: () =>
      wasteApi.getSummary(shopId, { from: period.from, to: period.to }),
  });

  const events = useQuery({
    queryKey: [
      "waste",
      "events",
      shopId,
      page,
      period.from,
      period.to,
    ],
    queryFn: () =>
      wasteApi.getEvents(shopId, page, DEFAULT_PAGE_SIZE, {
        from: period.from,
        to: period.to,
      }),
    placeholderData: (previous) => previous,
  });

  return { summary, events, period, setPeriod, setRange, page, setPage };
}
