// apps/web/src/features/inventory/components/InventoryFilters.tsx
"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { INVENTORY_CATEGORIES, STOCK_STATUS_FILTERS } from "../constants";

export interface InventoryFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
}

export function InventoryFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
}: InventoryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search items…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        leadingIcon={<Search className="h-4 w-4" />}
        className="w-56"
      />
      <Select
        value={category || "all"}
        onValueChange={onCategoryChange}
        options={[...INVENTORY_CATEGORIES]}
        className="w-48"
      />
      <Select
        value={status || "all"}
        onValueChange={onStatusChange}
        options={[...STOCK_STATUS_FILTERS]}
        className="w-40"
      />
    </div>
  );
}