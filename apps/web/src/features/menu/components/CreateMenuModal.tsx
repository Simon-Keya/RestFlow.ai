"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Alert } from "@/components/ui/Alert";
import { ApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/ToastProvider";
import { useAuthStore } from "@/store/auth";
import { canEditMenu } from "@/lib/permissions";
import { menuApi } from "../api";
import { inventoryApi } from "@/features/inventory/api";
import { createMenuSchema, type CreateMenuInput } from "../schema";
import { InventorySkuPicker } from "@/components/inventory/InventorySkuPicker";
import { useDebounce } from "@/hooks/use-debounce";

type LineKind = "FIXED" | "CHOICE";
/** How CHOICE options are sourced */
type ChoiceSource = "category" | "inventory";

type LineForm = {
  kind: LineKind;
  finished_good_id: string;
  finished_good_name: string;
  finished_good_category_id: string;
  choice_source: ChoiceSource;
  option_item_ids: string[];
  quantity_required: string;
  unit: string;
};

const emptyFixed = (): LineForm => ({
  kind: "FIXED",
  finished_good_id: "",
  finished_good_name: "",
  finished_good_category_id: "",
  choice_source: "category",
  option_item_ids: [],
  quantity_required: "1",
  unit: "pcs",
});

const emptyChoice = (): LineForm => ({
  kind: "CHOICE",
  finished_good_id: "",
  finished_good_name: "",
  finished_good_category_id: "",
  choice_source: "inventory",
  option_item_ids: [],
  quantity_required: "1",
  unit: "pcs",
});

export function CreateMenuModal({
  open,
  onOpenChange,
  shopId = "1",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId?: string;
}) {
  const [name, setName] = useState("");
  const [menuCode, setMenuCode] = useState("");
  const [category, setCategory] = useState("Combos");
  const [sellingPrice, setSellingPrice] = useState("");
  const [taxRate, setTaxRate] = useState("16");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyFixed()]);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const fgQuery = useQuery({
    queryKey: ["menu", "finished-goods", shopId],
    queryFn: () => menuApi.listFinishedGoods(shopId),
    enabled: open,
  });

  const catQuery = useQuery({
    queryKey: ["menu", "fg-categories"],
    queryFn: () => menuApi.listFinishedGoodCategories(),
    enabled: open,
  });

  /** Server-side inventory search for CHOICE → inventory select (not finished-goods list). */
  const [invSearch, setInvSearch] = useState("");
  const debouncedInvSearch = useDebounce(invSearch, 300);
  const needsInventoryPicker = lines.some(
    (l) => l.kind === "CHOICE" && l.choice_source === "inventory",
  );
  const invQuery = useQuery({
    queryKey: [
      "inventory",
      "menu-choice-picker",
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
    enabled: open && needsInventoryPicker,
  });

  const inventorySkuOptions = useMemo(
    () =>
      (invQuery.data?.items ?? []).map((item) => ({
        itemId: item.itemId,
        name: item.name,
        unit: item.unit,
        availableStock: item.availableStock,
        category: item.category ?? null,
      })),
    [invQuery.data?.items],
  );

  const hasFinishedGoods = (fgQuery.data?.length ?? 0) > 0;

  const fgOptions = useMemo(() => {
    const rows = fgQuery.data ?? [];
    return [
      { value: "", label: "Select finished good…" },
      ...rows.map((r) => ({
        value: r.itemId,
        label: `${r.name} (${r.itemId}) · ${r.availableStock} ${r.unit}`,
      })),
    ];
  }, [fgQuery.data]);

  const categoryOptions = useMemo(() => {
    const rows = catQuery.data ?? [];
    return [
      { value: "", label: "Select choice pool…" },
      ...rows.map((c) => ({
        value: c.id || c.code,
        label: `${c.name}${c.itemCount ? ` · ${c.itemCount} SKUs` : ""}`,
      })),
    ];
  }, [catQuery.data]);

  const fgById = useMemo(() => {
    const m = new Map<string, { name: string; unit: string }>();
    for (const r of fgQuery.data ?? []) {
      m.set(r.itemId, { name: r.name, unit: r.unit });
    }
    return m;
  }, [fgQuery.data]);

  const catById = useMemo(() => {
    const m = new Map<
      string,
      { code?: string; name?: string; id?: string }
    >();
    for (const c of catQuery.data ?? []) {
      const key = c.id || c.code;
      if (key) m.set(key, c);
    }
    return m;
  }, [catQuery.data]);

  function setLine(index: number, patch: Partial<LineForm>) {
    setLines((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }


  function resetForm() {
    setName("");
    setMenuCode("");
    setCategory("Combos");
    setSellingPrice("");
    setTaxRate("16");
    setNotes("");
    setLines([emptyFixed()]);
    setError(null);
  }

  const create = useMutation({
    mutationFn: (input: CreateMenuInput) => menuApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["menu"] });
      toast({ title: "Menu item created", variant: "success" });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not create menu item";
      setError(message);
    },
  });

  function handleSubmit() {
    if (!canEditMenu(useAuthStore.getState().user?.role)) {
      setError("Only administrators can create or edit menu items.");
      return;
    }

    setError(null);

    const builtLines = lines.map((line, i) => {
      if (line.kind === "CHOICE") {
        if (line.choice_source === "inventory") {
          return {
            component_type: "CHOICE" as const,
            component_key: `choice_${i + 1}`,
            option_item_ids: line.option_item_ids,
            quantity_required: Number(line.quantity_required) || 1,
            unit: line.unit || "pcs",
            min_select: 1,
            max_select: 1,
          };
        }
        const cat = catById.get(line.finished_good_category_id);
        return {
          component_type: "CHOICE" as const,
          component_key: `choice_${i + 1}`,
          finished_good_category_id: line.finished_good_category_id,
          finished_good_category_code: cat?.code,
          finished_good_category_name: cat?.name,
          quantity_required: Number(line.quantity_required) || 1,
          unit: line.unit || "pcs",
          min_select: 1,
          max_select: 1,
        };
      }

      const fg = fgById.get(line.finished_good_id);
      return {
        component_type: "FIXED" as const,
        component_key: `fixed_${i + 1}`,
        finished_good_id: line.finished_good_id,
        finished_good_name:
          line.finished_good_name || fg?.name || line.finished_good_id,
        quantity_required: Number(line.quantity_required) || 1,
        unit: line.unit || fg?.unit || "pcs",
      };
    });

    const parsed = createMenuSchema.safeParse({
      name: name.trim(),
      menu_code: menuCode.trim() || undefined,
      category: category.trim() || undefined,
      selling_price: Number(sellingPrice),
      tax_rate: Number(taxRate) || 16,
      notes: notes.trim() || undefined,
      lines: builtLines,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    create.mutate(parsed.data);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add menu item"
      description="FIXED = one finished good (searchable). CHOICE = category pool or inventory select — open each dropdown and type to search."
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        {error ? <Alert tone="danger" title="Could not save" description={error} /> : null}

        {!hasFinishedGoods && !fgQuery.isLoading ? (
          <Alert
            tone="warning"
            title="No finished goods yet"
            description="Create a recipe / produce FG stock first. FIXED lines need finished goods. Inventory select uses the inventory list (with search)."
          />
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lunch combo" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Menu code (optional)</label>
            <Input value={menuCode} onChange={(e) => setMenuCode(e.target.value)} placeholder="MENU-001" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">POS category / section</label>
            <SearchableSelect
              value={category}
              onValueChange={setCategory}
              options={[
                { value: "Combos", label: "Combos" },
                { value: "Mains", label: "Mains" },
                { value: "Sides", label: "Sides" },
                { value: "Drinks", label: "Drinks" },
                { value: "Desserts", label: "Desserts" },
                { value: "Breakfast", label: "Breakfast" },
                { value: "Specials", label: "Specials" },
              ].concat(
                category &&
                  ![
                    "Combos",
                    "Mains",
                    "Sides",
                    "Drinks",
                    "Desserts",
                    "Breakfast",
                    "Specials",
                  ].includes(category)
                  ? [{ value: category, label: category }]
                  : [],
              )}
              placeholder="Select section…"
              searchPlaceholder="Search section…"
            />
            <Input
              className="mt-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Or type a custom section name"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Selling price (KES)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Tax %</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <p className="text-sm font-medium text-ink">Components</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setLines((p) => [...p, emptyFixed()])}>
              <Plus className="h-3.5 w-3.5" /> FIXED
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setLines((p) => [...p, emptyChoice()])}>
              <Plus className="h-3.5 w-3.5" /> CHOICE
            </Button>
          </div>
        </div>

        {lines.map((line, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-lg border border-border p-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-muted">
                Line {index + 1} · {line.kind}
                {line.kind === "CHOICE"
                  ? line.choice_source === "inventory"
                    ? " · Inventory select"
                    : " · Category pool"
                  : ""}
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setLines((p) => p.filter((_, i) => i !== index))}
                disabled={lines.length <= 1}
                aria-label="Remove line"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {line.kind === "FIXED" ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-ink-muted">Finished good</label>
                  <SearchableSelect
                    value={line.finished_good_id}
                    onValueChange={(v) => {
                      const id = v === "__empty" ? "" : v;
                      const fg = fgById.get(id);
                      setLine(index, {
                        finished_good_id: id,
                        finished_good_name: fg?.name ?? "",
                        unit: fg?.unit ?? line.unit,
                      });
                    }}
                    options={fgOptions}
                    placeholder="Select finished good…"
                    searchPlaceholder="Search name or SKU…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Qty required</label>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.quantity_required}
                    onChange={(e) => setLine(index, { quantity_required: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Choice source</label>
                    <Select
                      value={line.choice_source}
                      onValueChange={(v) =>
                        setLine(index, {
                          choice_source: v as ChoiceSource,
                          finished_good_category_id: "",
                          option_item_ids: [],
                        })
                      }
                      options={[
                        { value: "inventory", label: "Inventory select (pick SKUs)" },
                        { value: "category", label: "Category pool" },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Qty required</label>
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={line.quantity_required}
                      onChange={(e) => setLine(index, { quantity_required: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Unit</label>
                    <Input
                      value={line.unit}
                      onChange={(e) => setLine(index, { unit: e.target.value })}
                    />
                  </div>
                </div>

                {line.choice_source === "category" ? (
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Finished-good category</label>
                    <SearchableSelect
                      value={line.finished_good_category_id}
                      onValueChange={(v) =>
                        setLine(index, {
                          finished_good_category_id: v === "__empty" ? "" : v,
                        })
                      }
                      options={categoryOptions}
                      placeholder="Select choice pool…"
                      searchPlaceholder="Search category…"
                    />
                    {(catQuery.data?.length ?? 0) === 0 ? (
                      <p className="mt-1 text-xs text-ink-muted">
                        No FG categories yet — use Inventory select, or create categories in master data.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-muted">
                      Inventory select — stock SKUs
                    </label>
                    <p className="mb-2 text-xs text-ink-muted">
                      Options load from Inventory (GET /inventory), with server search — not the finished-goods list.
                    </p>
                    <InventorySkuPicker
                      items={inventorySkuOptions}
                      selectedIds={line.option_item_ids}
                      mode="multi"
                      isLoading={invQuery.isLoading}
                      emptyTitle="No inventory SKUs"
                      emptyDescription="Receive goods or clear the search to see stock items for this shop."
                      onChange={(ids) => setLine(index, { option_item_ids: ids })}
                      searchValue={invSearch}
                      onSearchChange={setInvSearch}
                      serverSearch
                      totalAvailable={invQuery.data?.total}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} loading={create.isPending}>
            Create menu item
          </Button>
        </div>
      </div>
    </Modal>
  );
}
