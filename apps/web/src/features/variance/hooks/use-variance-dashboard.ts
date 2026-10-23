"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { varianceApi } from "../api";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants/config";

export function useVarianceDashboard(shopId: string) {
  const [page, setPage] = useState(1);

  const batches = useQuery({
    queryKey: ["variance", "batches", shopId, page],
    queryFn: () => varianceApi.getBatches(shopId, page, DEFAULT_PAGE_SIZE),
    placeholderData: (previous) => previous,
  });

  return { batches, page, setPage };
}
