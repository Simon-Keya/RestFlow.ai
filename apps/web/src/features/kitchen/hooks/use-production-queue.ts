"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { kitchenApi } from "../api";
import type { StartProductionInput } from "../schema";

export function useProductionQueue(shopId: string) {
  const queryClient = useQueryClient();

  const queue = useQuery({
    queryKey: ["kitchen", "production-queue", shopId],

    queryFn: () => kitchenApi.getProductionQueue(shopId),

    enabled: Boolean(shopId),

    refetchInterval: 20_000,

    staleTime: 5_000,
  });

  const refreshQueue = () => {
    void queryClient.invalidateQueries({
      queryKey: ["kitchen", "production-queue", shopId],
    });
  };

  const start = useMutation({
    mutationFn: (input: StartProductionInput) =>
      kitchenApi.startProduction(input),

    onSuccess: refreshQueue,
  });

  const finish = useMutation({
    mutationFn: ({
      productionId,
      actualYield,
    }: {
      productionId: string;
      actualYield: number;
    }) =>
      kitchenApi.finishProduction(
        productionId,
        actualYield,
      ),

    onSuccess: refreshQueue,
  });

  return {
    queue,
    start,
    finish,
  };
}
