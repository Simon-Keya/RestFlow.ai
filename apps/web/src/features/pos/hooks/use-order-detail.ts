"use client";

import { useQuery } from "@tanstack/react-query";
import { posApi } from "../api";

export function useOrderDetail(orderId: string) {
  return useQuery({
    queryKey: ["pos", "order", orderId],
    queryFn: () => posApi.getOrder(orderId),
    refetchInterval: 10_000,
  });
}
