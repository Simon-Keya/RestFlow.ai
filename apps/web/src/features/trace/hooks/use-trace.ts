"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { traceApi } from "../api";
import type { TraceSearchParams } from "../types";

export function useTrace(shopId: string) {
  const [params, setParams] = useState<TraceSearchParams>({});

  const results = useQuery({
    queryKey: ["trace", "search", shopId, params],
    queryFn: () => traceApi.search(shopId, params),
    enabled: Object.values(params).some(Boolean),
    placeholderData: (previous) => previous,
  });

  function search(next: TraceSearchParams) {
    setParams(next);
  }

  return { results, search, params };
}