"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recipeApi } from "../api";
import type { CreateRecipeInput } from "../schema";

export function useCreateRecipe(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRecipeInput) => recipeApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["recipes", "list", shopId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["kitchen", "recipes", shopId],
      });
    },
  });
}