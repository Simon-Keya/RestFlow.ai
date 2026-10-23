// apps/web/src/features/inventory/hooks/use-inventory.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { inventoryApi, type InventoryListParams } from "../api";

export function useInventory(params: InventoryListParams) {
  const pageSize = params.pageSize ?? 20;

  return useQuery({
    queryKey: [
      "inventory",
      "list",
      params.shopId,
      params.search ?? "",
      params.category ?? "",
      params.status ?? "",
      params.page ?? 1,
      pageSize,
    ],
    queryFn: () =>
      inventoryApi.list({
        ...params,
        pageSize,
      }),
    placeholderData: (previous) => previous,
  });
}