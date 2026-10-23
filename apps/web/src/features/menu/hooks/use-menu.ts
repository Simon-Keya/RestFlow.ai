// apps/web/src/features/menu/hooks/use-menu.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { menuApi } from "../api";

export function useMenu(shopId: string) {
  return useQuery({
    queryKey: ["menu", "list", shopId],
    queryFn: () => menuApi.list(shopId),
    enabled: Boolean(shopId),
  });
}