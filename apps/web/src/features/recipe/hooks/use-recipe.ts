"use client";

import { useQuery } from "@tanstack/react-query";
import { recipeApi } from "../api";

export function useRecipe(recipeId: string) {
  return useQuery({
    queryKey: ["recipes", "detail", recipeId],
    queryFn: () => recipeApi.get(recipeId),
    enabled: !!recipeId,
  });
}