"use client";

import { useQuery } from "@tanstack/react-query";
import { kitchenApi } from "../api";

export function useKitchenDashboard(shopId: string) {
  const activeOrders = useQuery({
    queryKey: ["kitchen", "active-orders", shopId],
    queryFn: () => kitchenApi.getActiveOrders(shopId),
    refetchInterval: 15_000,
  });

  const recipes = useQuery({
    queryKey: ["kitchen", "recipes", shopId],
    queryFn: () => kitchenApi.getRecipes(shopId),
    refetchInterval: 60_000,
  });

  return { activeOrders, recipes };
}