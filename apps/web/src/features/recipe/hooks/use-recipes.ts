"use client";

import { useQuery } from "@tanstack/react-query";
import { recipeApi } from "../api";

export function useRecipes(shopId: string) {
  return useQuery({
    queryKey: ["recipes", "list", shopId],
    queryFn: () => recipeApi.list(shopId),
    enabled: !!shopId,
  });
}