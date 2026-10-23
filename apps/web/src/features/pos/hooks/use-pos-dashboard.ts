"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { posApi } from "../api";
import type { MenuAvailability } from "../types";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants/config";

/** Menu row from bootstrap when availability array is empty (Go / Nest shape). */
type BootstrapMenuRow = {
  menuItemId?: string;
  menuId?: string;
  menu_id?: string;
  name?: string;
  isAvailable?: boolean;
  is_available?: boolean;
  maxPortions?: number;
  availableQuantity?: number;
};

function availabilityFromMenus(
  menus: BootstrapMenuRow[],
): MenuAvailability[] {
  return menus
    .map((m): MenuAvailability | null => {
      const menuItemId = String(
        m.menuItemId ?? m.menuId ?? m.menu_id ?? "",
      ).trim();
      if (!menuItemId) return null;
      const maxPortions = Math.max(
        0,
        Math.floor(Number(m.maxPortions ?? m.availableQuantity ?? 0)),
      );
      const isAvailable =
        m.isAvailable !== false &&
        m.is_available !== false &&
        maxPortions > 0;
      return {
        menuItemId,
        menuCode: menuItemId,
        name: String(m.name ?? menuItemId),
        isAvailable,
        isLow: isAvailable && maxPortions > 0 && maxPortions <= 5,
        maxPortions,
        availableQuantity: maxPortions,
        finishedGoodId: null,
      };
    })
    .filter((x): x is MenuAvailability => x !== null);
}

export function usePosDashboard(shopId: string) {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const orders = useQuery({
    queryKey: ["pos", "orders", shopId, status, page],
    queryFn: () =>
      posApi.getOrders({
        shopId,
        status,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      }),
    refetchInterval: 30_000,
    staleTime: 10_000,
    placeholderData: (previous) => previous,
  });

  /** One RTT: availability (+ menus/combos/categories for cache warm) */
  const bootstrap = useQuery({
    queryKey: ["pos", "bootstrap", shopId],
    queryFn: () => posApi.getBootstrap(shopId),
    refetchInterval: 60_000,
    staleTime: 45_000,
  });

  const menuAvailability = {
    ...bootstrap,
    data: ((): MenuAvailability[] => {
      const av = bootstrap.data?.availability ?? [];
      if (av.length > 0) return av;
      // Typed bootstrap only exposes `menus` (Go also sends `items`; api normalizes into menus)
      const raw = bootstrap.data?.menus ?? [];
      if (!Array.isArray(raw)) return [];
      return availabilityFromMenus(raw as BootstrapMenuRow[]);
    })(),
  };

  return {
    orders,
    menuAvailability,
    bootstrap,
    status,
    setStatus: (s: string) => {
      setStatus(s);
      setPage(1);
    },
    page,
    setPage,
  };
}
