"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { varianceApi } from "../api";
import type { ReasonCodeInput } from "../schema";

export function useBatchVariance(batchId: string) {
  const queryClient = useQueryClient();

  const batch = useQuery({
    queryKey: ["variance", "batch", batchId],
    queryFn: () => varianceApi.getBatch(batchId),
  });

  const submitReasonCode = useMutation({
    mutationFn: (input: ReasonCodeInput) => varianceApi.submitReasonCode(batchId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["variance", "batch", batchId] }),
  });

  const flagBatch = useMutation({
    mutationFn: (input: { flagged: boolean; note?: string }) =>
      varianceApi.flagBatch(batchId, input.flagged, input.note),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["variance", "batch", batchId] }),
  });

  return { batch, submitReasonCode, flagBatch };
}
