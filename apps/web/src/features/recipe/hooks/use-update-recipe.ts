// apps/web/src/features/recipes/hooks/use-update-recipe.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recipeApi } from "../api";
import type { UpdateRecipeInput } from "../schema";

export function useUpdateRecipe(shopId: string, recipeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateRecipeInput) =>
      recipeApi.update(recipeId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["recipes", "detail", recipeId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["recipes", "list", shopId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["kitchen", "recipes", shopId],
      });
    },
  });
}