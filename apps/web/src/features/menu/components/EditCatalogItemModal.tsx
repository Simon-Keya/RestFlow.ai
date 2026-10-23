"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { formatCurrency } from "@/lib/format/currency";
import { inventoryApi } from "@/features/inventory/api";
import type { MenuComponentLine, MenuItem } from "../types";

export type CatalogItemEdit = {
  menuItemId: string;
  name: string;
  sellingPrice: number;
  active: boolean;
  menuCode?: string | null;
  category?: string | null;
  taxRate?: number | null;
  menu?: MenuItem | null;
  expectedUpdatedAt?: string | null;
};

type DraftLine = {
  key: string;
  componentType: "FIXED" | "INVENTORY" | "CHOICE";
  itemId: string;
  itemName: string;
  quantity: string;
  unit: string;
  unitCost: number;
};

type SavePatch = {
  name: string;
  menu_code?: string | null;
  category?: string | null;
  selling_price: number;
  tax_rate?: number;
  active: boolean;
  is_available?: boolean;
  is_visible?: boolean;
  lines?: Array<{
    component_key: string;
    component_type: string;
    finished_good_id?: string;
    finished_good_name?: string;
    option_item_ids?: string[];
    quantity_required: number;
    unit: string;
  }>;
  expected_updated_at?: string | null;
};

type Props = {
  item: CatalogItemEdit | null;
  open: boolean;
  shopId?: string;
  allMenuNames?: string[];
  onClose: () => void;
  onSave: (patch: SavePatch) => Promise<void>;
};

type SkuSuggestion = {
  itemId: string;
  name: string;
  unit: string;
  avgUnitCost: number;
  category: string;
  availableStock: number;
};

function linesFromMenu(menu?: MenuItem | null): DraftLine[] {
  if (!menu?.lines?.length) {
    return [
      {
        key: "line-0",
        componentType: "FIXED",
        itemId: menu?.finishedGoodId ?? "",
        itemName: menu?.finishedGoodName ?? "",
        quantity: String(menu?.quantityRequired ?? 1),
        unit: menu?.unit ?? "pcs",
        unitCost: menu?.unitCost ?? 0,
      },
    ];
  }
  return menu.lines.map((l: MenuComponentLine, i: number) => {
    const isChoice =
      l.componentType === "CHOICE" || l.componentType === "MULTI_CHOICE";
    const firstOpt = l.options?.[0];
    return {
      key: l.componentKey || `line-${i}`,
      componentType: (isChoice
        ? "CHOICE"
        : l.componentType === "INVENTORY"
          ? "INVENTORY"
          : "FIXED") as DraftLine["componentType"],
      itemId: isChoice
        ? (l.options ?? []).map((o) => o.finishedGoodId).join(",")
        : (l.finishedGoodId ?? ""),
      itemName: isChoice
        ? (l.options ?? []).map((o) => o.finishedGoodName).join(", ")
        : (l.finishedGoodName ?? ""),
      quantity: String(l.quantityRequired ?? 1),
      unit: l.unit || "pcs",
      unitCost: Number(l.unitCost ?? firstOpt?.unitCost ?? 0),
    };
  });
}

/** ADMIN Adjust: same domain fields as Create (name, code, category, price, tax, visibility, components). */
export function EditCatalogItemModal({
  item,
  open,
  shopId = "1",
  allMenuNames = [],
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState("");
  const [menuCode, setMenuCode] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("0");
  const [taxRate, setTaxRate] = useState("16");
  const [active, setActive] = useState(true);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [skuSearch, setSkuSearch] = useState("");
  const [activeLineKey, setActiveLineKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item && open) {
      setName(item.name);
      setMenuCode(item.menuCode ?? item.menu?.menuCode ?? "");
      setCategory(item.category ?? item.menu?.category ?? "");
      setPrice(String(item.sellingPrice));
      setTaxRate(String(item.taxRate ?? item.menu?.taxRate ?? 16));
      setActive(item.active);
      setLines(linesFromMenu(item.menu));
      setError(null);
      setSkuSearch("");
      setActiveLineKey(null);
    }
  }, [item, open]);

  const suggestQ = useQuery({
    queryKey: ["inventory", "suggest-list", shopId, skuSearch],
    queryFn: async (): Promise<SkuSuggestion[]> => {
      const page = await inventoryApi.list({
        shopId,
        search: skuSearch.trim(),
        page: 1,
        pageSize: 8,
      });
      return (page.items ?? []).map((row) => ({
        itemId: row.itemId,
        name: row.name,
        unit: row.unit || "pcs",
        avgUnitCost: Number(row.unitCost ?? 0),
        category: row.category ?? "",
        availableStock: Number(row.availableStock ?? 0),
      }));
    },
    enabled: open && skuSearch.trim().length >= 1,
  });

  const suggestions: SkuSuggestion[] = suggestQ.data ?? [];

  const estimatedCost = useMemo(() => {
    return lines.reduce((sum, l) => {
      const qty = Number(l.quantity);
      if (!Number.isFinite(qty) || qty <= 0) return sum;
      return sum + qty * (Number(l.unitCost) || 0);
    }, 0);
  }, [lines]);

  const selling = Number(price);
  const tax = Number(taxRate);
  const margin =
    Number.isFinite(selling) && selling > 0 ? selling - estimatedCost : null;
  const marginPct = margin != null && selling > 0 ? margin / selling : null;

  const qtyInvalid = lines.some((l) => {
    const q = Number(l.quantity);
    return !Number.isFinite(q) || q <= 0;
  });
  const missingItem = lines.some((l) => !l.itemId.trim());
  const priceInvalid = !Number.isFinite(selling) || selling < 0;
  const taxInvalid = !Number.isFinite(tax) || tax < 0 || tax > 100;
  const canSave =
    Boolean(name.trim()) &&
    !priceInvalid &&
    !taxInvalid &&
    lines.length >= 1 &&
    !qtyInvalid &&
    !missingItem &&
    !busy;

  const nameClash =
    name.trim().length > 0 &&
    allMenuNames.some(
      (n) =>
        n.trim().toLowerCase() === name.trim().toLowerCase() &&
        n.trim().toLowerCase() !== (item?.name ?? "").trim().toLowerCase(),
    );

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  function removeLine(key: string) {
    setLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((l) => l.key !== key),
    );
  }

  function addLine(kind: "FIXED" | "INVENTORY" | "CHOICE" = "INVENTORY") {
    setLines((prev) => [
      ...prev,
      {
        key: `line-${Date.now()}`,
        componentType: kind,
        itemId: "",
        itemName: "",
        quantity: "1",
        unit: "pcs",
        unitCost: 0,
      },
    ]);
  }

  function pickSuggestion(lineKey: string, s: SkuSuggestion) {
    updateLine(lineKey, {
      itemId: s.itemId,
      itemName: s.name,
      unit: s.unit || "pcs",
      unitCost: Number(s.avgUnitCost ?? 0),
      componentType: "INVENTORY",
    });
    setSkuSearch("");
    setActiveLineKey(null);
  }

  async function handleSave() {
    // Narrow item for strict TS (prop type is CatalogItemEdit | null)
    if (!item) {
      setError("No item selected");
      return;
    }
    const current = item;
    setError(null);
    if (!canSave) {
      setError("Fix validation errors before saving");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        menu_code: menuCode.trim() || null,
        category: category.trim() || null,
        selling_price: selling,
        tax_rate: tax,
        active,
        is_available: active,
        is_visible: active,
        expected_updated_at:
          current.expectedUpdatedAt ?? current.menu?.createdAt ?? null,
        lines: lines.map((l, i) => {
          const qty = Number(l.quantity);
          if (l.componentType === "CHOICE") {
            const ids = l.itemId
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
            return {
              component_key: l.key || `c${i}`,
              component_type: "CHOICE",
              option_item_ids: ids,
              quantity_required: qty,
              unit: l.unit || "pcs",
            };
          }
          return {
            component_key: l.key || `c${i}`,
            component_type:
              l.componentType === "INVENTORY" ? "INVENTORY" : "FIXED",
            finished_good_id: l.itemId.trim(),
            finished_good_name: l.itemName || undefined,
            quantity_required: qty,
            unit: l.unit || "pcs",
          };
        }),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-lg">
        <h2 className="text-lg font-semibold text-ink">Adjust menu item</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Editing {item.menuItemId} — same fields as create; new price applies to
          new orders only
        </p>

        {error ? (
          <div className="mt-3">
            <Alert tone="danger" title="Could not save" description={error} />
          </div>
        ) : null}
        {nameClash ? (
          <div className="mt-3">
            <Alert
              tone="warning"
              title="Duplicate name"
              description={`Another active item is already named ${name}. You can still save.`}
            />
          </div>
        ) : null}

        <label className="mt-4 block text-sm font-medium text-ink">
          Item name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-ink">
              Menu code
            </label>
            <Input
              value={menuCode}
              onChange={(e) => setMenuCode(e.target.value)}
              className="mt-1"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink">
              POS category
            </label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1"
              placeholder="Mains, Combos…"
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-ink">
              Selling price (Ksh)
            </label>
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min={0}
              step="0.01"
              className="mt-1"
            />
            {priceInvalid ? (
              <p className="mt-1 text-xs text-red-600">Price must be 0 or more</p>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-ink">
              Tax rate (%)
            </label>
            <Input
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              type="number"
              min={0}
              max={100}
              step="0.01"
              className="mt-1"
            />
            {taxInvalid ? (
              <p className="mt-1 text-xs text-red-600">Tax must be 0–100</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">
              Items making this menu item
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => addLine("INVENTORY")}
            >
              <Plus className="h-3.5 w-3.5" /> Component
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {lines.map((line) => (
              <div
                key={line.key}
                className="rounded-md border border-border p-2"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      placeholder="Search by name or SKU…"
                      value={
                        activeLineKey === line.key
                          ? skuSearch
                          : line.itemName
                            ? `${line.itemName}`
                            : ""
                      }
                      onFocus={() => {
                        setActiveLineKey(line.key);
                        setSkuSearch(line.itemName || "");
                      }}
                      onChange={(e) => {
                        setActiveLineKey(line.key);
                        setSkuSearch(e.target.value);
                        updateLine(line.key, {
                          itemId: "",
                          itemName: "",
                          unitCost: 0,
                        });
                      }}
                      className="text-sm"
                    />
                    {activeLineKey === line.key &&
                    skuSearch.trim().length >= 1 &&
                    suggestions.length > 0 ? (
                      <div className="mt-1 max-h-32 overflow-auto rounded border border-border bg-white text-sm shadow">
                        {suggestions.map((s) => (
                          <button
                            key={s.itemId}
                            type="button"
                            className="block w-full px-2 py-1.5 text-left hover:bg-surface-muted"
                            onClick={() => pickSuggestion(line.key, s)}
                          >
                            {s.name}{" "}
                            <span className="text-xs text-ink-muted">
                              {s.itemId} · {s.unit}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <Input
                    type="number"
                    min={0.0001}
                    step="any"
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.key, { quantity: e.target.value })
                    }
                    className="w-20"
                  />
                  <span className="mt-2 w-10 text-xs text-ink-muted">
                    {line.unit}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={lines.length <= 1}
                    onClick={() => removeLine(line.key)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {Number(line.quantity) <= 0 ? (
                  <p className="mt-1 text-xs text-red-600">
                    Quantity must be greater than 0
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-md bg-surface-muted px-3 py-2 text-sm">
          <span className="text-ink-muted">Cost per serving: </span>
          <span className="font-medium tabular-nums">
            {formatCurrency(estimatedCost)}
          </span>
          {marginPct != null ? (
            <>
              <span className="mx-2 text-ink-faint">·</span>
              <span className="text-ink-muted">Margin: </span>
              <span className="font-medium tabular-nums">
                {(marginPct * 100).toFixed(0)}%
              </span>
            </>
          ) : null}
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active (available &amp; visible on POS)
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            loading={busy}
            disabled={!canSave}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
