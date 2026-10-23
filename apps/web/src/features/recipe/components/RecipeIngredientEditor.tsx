"use client";

import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { InventorySkuPicker } from "@/components/inventory/InventorySkuPicker";
import { inventoryApi } from "@/features/inventory/api";
import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { buildQueryString } from "@/lib/utils";
import { INGREDIENT_UNITS } from "../constants";

export type IngredientDraft = {
  rawItemId: string;
  rawItemName: string;
  quantityPerUnit: string;
  unit: string;
  unitCost: string;
};

async function fetchWac(shopId: string, itemId: string): Promise<number> {
  if (!itemId.trim()) return 0;
  try {
    const { data } = await apiClient.get(
      `${endpoints.costing.sku(itemId.trim())}${buildQueryString({ shopId })}`,
    );
    const root = (data ?? {}) as Record<string, unknown>;
    return Number(root.avgUnitCost ?? root.avg_unit_cost ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function RecipeIngredientsEditor({
  rows,
  onChange,
  shopId = "1",
}: {
  rows: IngredientDraft[];
  onChange: (rows: IngredientDraft[]) => void;
  shopId?: string;
}) {
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const [invSearch, setInvSearch] = useState("");
  const debouncedInvSearch = useDebounce(invSearch, 300);

  const stockQuery = useQuery({
    queryKey: [
      "inventory",
      "recipe-ingredient-picker",
      shopId,
      debouncedInvSearch,
    ],
    queryFn: () =>
      inventoryApi.list({
        shopId,
        page: 1,
        pageSize: 50,
        search: debouncedInvSearch.trim() || undefined,
      }),
  });

  const skuOptions = useMemo(
    () =>
      (stockQuery.data?.items ?? []).map((item) => ({
        itemId: item.itemId,
        name: item.name,
        unit: item.unit,
        availableStock: item.availableStock,
        category: item.category,
      })),
    [stockQuery.data?.items],
  );

  function update(index: number, patch: Partial<IngredientDraft>) {
    onChange(
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index));
    if (pickerIndex === index) setPickerIndex(null);
  }

  function add() {
    onChange([
      ...rows,
      {
        rawItemId: "",
        rawItemName: "",
        quantityPerUnit: "",
        unit: "kg",
        unitCost: "",
      },
    ]);
  }

  async function applySku(index: number, itemId: string) {
    const hit = skuOptions.find((s) => s.itemId === itemId);
    const wac = await fetchWac(shopId, itemId);
    update(index, {
      rawItemId: hit?.itemId ?? itemId,
      rawItemName: hit?.name ?? rows[index]?.rawItemName ?? "",
      unit: hit?.unit || rows[index]?.unit || "kg",
      unitCost: wac > 0 ? String(wac) : rows[index]?.unitCost ?? "",
    });
    setPickerIndex(null);
  }

  // When SKU typed manually, refresh WAC once blur-like via effect on rows with empty cost
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row?.rawItemId?.trim() || row.unitCost.trim() !== "") continue;
        const wac = await fetchWac(shopId, row.rawItemId);
        if (cancelled || !(wac > 0)) continue;
        onChange(
          rows.map((r, j) =>
            j === i && r.unitCost.trim() === ""
              ? { ...r, unitCost: String(wac) }
              : r,
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.rawItemId).join("|"), shopId]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Ingredients</p>
        <Button type="button" size="sm" variant="secondary" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Add line
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Add at least one raw material line.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <div
              key={index}
              className="flex flex-col gap-2 rounded-lg border border-border p-3"
            >
              <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-ink-muted">
                    Raw SKU
                  </label>
                  <Input
                    value={row.rawItemId}
                    onChange={(e) =>
                      update(index, {
                        rawItemId: e.target.value,
                        unitCost: "",
                      })
                    }
                    placeholder="e.g. ST300"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="mb-1 block text-xs text-ink-muted">
                    Name
                  </label>
                  <Input
                    value={row.rawItemName}
                    onChange={(e) =>
                      update(index, { rawItemName: e.target.value })
                    }
                    placeholder="e.g. Exe Flour"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-ink-muted">
                    Qty / unit
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={row.quantityPerUnit}
                    onChange={(e) =>
                      update(index, { quantityPerUnit: e.target.value })
                    }
                    placeholder="0.5"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-ink-muted">
                    Unit
                  </label>
                  <Select
                    value={row.unit}
                    onValueChange={(v) => update(index, { unit: v })}
                    options={INGREDIENT_UNITS.map((u) => ({
                      value: u.value,
                      label: u.label,
                    }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-ink-muted">
                    Unit cost (WAC)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={row.unitCost}
                    readOnly
                    title="Live weighted-average cost from inventory — not typed by hand"
                    className="bg-surface-muted"
                    placeholder="from inventory"
                  />
                </div>
                <div className="flex items-end md:col-span-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => remove(index)}
                    aria-label="Remove ingredient"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setPickerIndex(pickerIndex === index ? null : index)
                  }
                >
                  {pickerIndex === index
                    ? "Hide inventory select"
                    : "Pick from inventory"}
                </Button>
                <span className="text-xs text-ink-muted">
                  Unit cost is locked to inventory WAC (updates when SKU is
                  set).
                </span>
              </div>

              {pickerIndex === index ? (
                <InventorySkuPicker
                  items={skuOptions}
                  selectedIds={row.rawItemId ? [row.rawItemId] : []}
                  mode="single"
                  isLoading={stockQuery.isLoading}
                  serverSearch
                  searchValue={invSearch}
                  onSearchChange={setInvSearch}
                  totalAvailable={stockQuery.data?.total}
                  emptyTitle="No inventory rows"
                  emptyDescription="Receive goods first, then link ingredients."
                  onChange={(ids) => {
                    const id = ids[0];
                    if (id) void applySku(index, id);
                    else
                      update(index, {
                        rawItemId: "",
                        rawItemName: "",
                        unitCost: "",
                      });
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
