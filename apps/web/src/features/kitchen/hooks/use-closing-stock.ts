// apps/web/src/features/kitchen/hooks/use-closing-stock.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { kitchenApi } from "../api";
import type { ClosingStockSubmission } from "../schema";

export function useClosingStock(shopId: string) {
  const queryClient = useQueryClient();

  const form = useQuery({
    queryKey: ["kitchen", "closing-stock", shopId],
    queryFn: () => kitchenApi.getClosingStock(shopId),
  });

  const submit = useMutation({
    mutationFn: (submission: ClosingStockSubmission) =>
      kitchenApi.submitClosingStock(shopId, submission),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["kitchen", "closing-stock", shopId],
      });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return { form, submit };
}
