// apps/web/src/features/kitchen/hooks/use-recipe-detail.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { kitchenApi } from "../api";

export function useRecipeDetail(recipeId: string) {
  return useQuery({
    queryKey: ["kitchen", "recipe", recipeId],
    queryFn: () => kitchenApi.getRecipe(recipeId),
    enabled: Boolean(recipeId),
  });
}