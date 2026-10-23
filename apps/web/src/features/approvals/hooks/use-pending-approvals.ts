"use client";

import { useQuery } from "@tanstack/react-query";
import { readAuthTokenClient } from "@/lib/auth/token";
import { approvalsApi } from "../api";

export function usePendingApprovals(shopId: string) {
  return useQuery({
    queryKey: ["approvals", "pending", shopId],
    queryFn: () => approvalsApi.getPending(shopId),
    enabled: typeof window !== "undefined" && Boolean(readAuthTokenClient()),
    refetchInterval: 60_000,
  });
}
