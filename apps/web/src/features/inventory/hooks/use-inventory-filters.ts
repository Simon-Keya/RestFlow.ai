"use client";

import { useMemo, useState } from "react";
import type { InventoryListParams } from "../api";

export function useInventoryFilters() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      category: category !== "all" ? category : undefined,
      status: status !== "all" ? status : undefined,
    }),
    [search, category, status],
  );

  return {
    search,
    setSearch,
    category,
    setCategory,
    status,
    setStatus,
    queryParams: queryParams as Pick<
      InventoryListParams,
      "search" | "category" | "status"
    >,
  };
}