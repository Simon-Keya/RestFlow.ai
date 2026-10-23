"use client";

import { useMemo, useState } from "react";
import { Package, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { humanize } from "@/lib/utils";

export type InventorySkuOption = {
  itemId: string;
  name: string;
  unit: string;
  availableStock: number;
  category?: string | null;
};

export type InventorySkuPickerProps = {
  items: InventorySkuOption[];
  selectedIds: string[];
  /** multi = checkboxes (CHOICE inventory select); single = radio-style one SKU */
  mode?: "multi" | "single";
  onChange: (nextIds: string[]) => void;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  /** Optional max height class for the scroll region */
  maxHeightClassName?: string;
  /**
   * When true, the search box drives server-side filtering via onSearchChange.
   * Client-side filter is skipped so results are not limited to a preloaded page.
   */
  serverSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (query: string) => void;
  /** Total matches from the server (for footer text). */
  totalAvailable?: number;
};

/**
 * Shared inventory-select list — visual parity with Dashboard → Inventory.
 * Parent should load options from inventoryApi.list (not finished-goods).
 */
export function InventorySkuPicker({
  items,
  selectedIds,
  mode = "multi",
  onChange,
  isLoading = false,
  emptyTitle = "No stock items",
  emptyDescription = "Receive goods or produce stock to link them here.",
  className,
  maxHeightClassName = "max-h-52",
  serverSearch = false,
  searchValue,
  onSearchChange,
  totalAvailable,
}: InventorySkuPickerProps) {
  const [localQuery, setLocalQuery] = useState("");
  const query = serverSearch ? (searchValue ?? "") : localQuery;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    if (serverSearch) return items;
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      const cat = (row.category ?? "").toLowerCase();
      return (
        row.name.toLowerCase().includes(q) ||
        row.itemId.toLowerCase().includes(q) ||
        cat.includes(q)
      );
    });
  }, [items, query, serverSearch]);

  function toggle(itemId: string) {
    if (mode === "single") {
      onChange(selectedSet.has(itemId) ? [] : [itemId]);
      return;
    }
    if (selectedSet.has(itemId)) {
      onChange(selectedIds.filter((id) => id !== itemId));
    } else {
      onChange([...selectedIds, itemId]);
    }
  }

  function handleQueryChange(next: string) {
    if (serverSearch && onSearchChange) {
      onSearchChange(next);
    } else {
      setLocalQuery(next);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search name, SKU, or category…"
          className="pl-9"
          aria-label="Search inventory SKUs"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>
          {selectedIds.length > 0
            ? `${selectedIds.length} selected`
            : "None selected"}
        </span>
        <span>
          {isLoading
            ? "Loading…"
            : serverSearch
              ? `${filtered.length} shown${
                  totalAvailable != null ? ` · ${totalAvailable} match total` : ""
                }`
              : `${filtered.length}${
                  filtered.length !== items.length ? ` of ${items.length}` : ""
                } shown`}
        </span>
      </div>

      <div
        className={cn(
          "overflow-y-auto rounded-md border border-border",
          maxHeightClassName,
        )}
      >
        {isLoading && items.length === 0 ? (
          <p className="p-3 text-sm text-ink-muted">Loading inventory…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((row) => {
              const checked = selectedSet.has(row.itemId);
              return (
                <li key={row.itemId}>
                  <button
                    type="button"
                    onClick={() => toggle(row.itemId)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-muted",
                      checked && "bg-primary-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked
                          ? "border-primary-600 bg-primary-600 text-white"
                          : "border-border",
                      )}
                      aria-hidden
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">
                        {row.name}
                      </span>
                      <span className="block truncate text-xs text-ink-muted">
                        {row.itemId}
                        {row.category ? ` · ${humanize(row.category)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-xs text-ink-muted">
                      {row.availableStock} {row.unit}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
