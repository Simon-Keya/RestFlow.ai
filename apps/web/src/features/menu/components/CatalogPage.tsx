"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { InventorySkuPicker } from "@/components/inventory/InventorySkuPicker";
import { inventoryApi } from "@/features/inventory/api";
import { useDebounce } from "@/hooks/use-debounce";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format/currency";
import { ApiError } from "@/lib/api/errors";
import { menuApi } from "../api";
import type { CreateMenuInput } from "../schema";
import { useAuthStore } from "@/store/auth";
import { canEditMenu } from "@/lib/permissions";
import { EditCatalogItemModal, type CatalogItemEdit } from "./EditCatalogItemModal";
import { adminEditApi, type AdjustMenuBody } from "../adminEditApi";

type LineKind = "FIXED" | "CHOICE";
type LineForm = {
  kind: LineKind;
  finished_good_id: string;
  finished_good_name: string;
  finished_good_category_id: string;
  /** Inventory Select: explicit SKUs */
  option_item_ids: string[];
  quantity_required: string;
  unit: string;
};
type ComboGroupForm = { menu_category_id: string; quantity: string };

const emptyFixed = (): LineForm => ({
  kind: "FIXED",
  finished_good_id: "",
  finished_good_name: "",
  finished_good_category_id: "",
  option_item_ids: [],
  quantity_required: "1",
  unit: "pcs",
});

/** Same label for Fixed FG and Inventory Select (Michael UX parity). */
function formatFgOptionLabel(fg: {
  name?: string;
  itemId: string;
  availableStock?: number;
  unit?: string;
}): string {
  const name = (fg.name || fg.itemId).trim();
  const stock =
    fg.availableStock != null && Number.isFinite(Number(fg.availableStock))
      ? Number(fg.availableStock)
      : null;
  const unit = (fg.unit || "").trim();
  const stockPart =
    stock != null
      ? ` · ${stock}${unit ? ` ${unit}` : ""}`
      : unit
        ? ` · ${unit}`
        : "";
  return `${name} (${fg.itemId})${stockPart}`;
}

const emptyChoice = (): LineForm => ({
  kind: "CHOICE",
  finished_good_id: "",
  finished_good_name: "",
  finished_good_category_id: "",
  option_item_ids: [],
  quantity_required: "1",
  unit: "pcs",
});

export function CatalogPage({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = canEditMenu(role);
  const [editItem, setEditItem] = useState<CatalogItemEdit | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const menuQ = useQuery({
    queryKey: ["menu", "list", shopId],
    queryFn: () => menuApi.list(shopId),
  });
  const catsQ = useQuery({
    queryKey: ["menu-categories", shopId],
    queryFn: () => menuApi.listCategories(shopId),
  });
  const combosQ = useQuery({
    queryKey: ["menu-combos", shopId],
    queryFn: () => menuApi.listCombos(shopId),
  });
  const fgQ = useQuery({
    queryKey: ["menu", "finished-goods", shopId],
    queryFn: () => menuApi.listFinishedGoods(shopId),
  });
  const fgCatQ = useQuery({
    queryKey: ["menu", "fg-categories"],
    queryFn: () => menuApi.listFinishedGoodCategories(),
  });

  const [name, setName] = useState("");
  const [menuCode, setMenuCode] = useState("");
  const [posCategory, setPosCategory] = useState("Mains");
  const [sellingPrice, setSellingPrice] = useState("");
  const [taxRate, setTaxRate] = useState("16");
  const [lines, setLines] = useState<LineForm[]>([emptyFixed()]);
  const [itemError, setItemError] = useState<string | null>(null);

  const [invSearch, setInvSearch] = useState("");
  const debouncedInvSearch = useDebounce(invSearch, 300);
  const needsInvPicker = lines.some((l) => l.kind === "CHOICE");
  const invQ = useQuery({
    queryKey: ["inventory", "catalog-choice-picker", shopId, debouncedInvSearch],
    queryFn: () =>
      inventoryApi.list({
        shopId,
        page: 1,
        pageSize: 50,
        search: debouncedInvSearch.trim() || undefined,
      }),
    enabled: needsInvPicker,
  });
  const inventorySkuOptions = useMemo(
    () =>
      (invQ.data?.items ?? []).map((item) => ({
        itemId: item.itemId,
        name: item.name,
        unit: item.unit,
        availableStock: item.availableStock,
        category: item.category ?? null,
      })),
    [invQ.data?.items],
  );
  const fgSelectOptions = useMemo(() => {
    const rows = fgQ.data ?? [];
    return [
      { value: "", label: "Select finished good…" },
      ...rows.map((fg) => ({
        value: fg.itemId,
        label: formatFgOptionLabel(fg),
      })),
    ];
  }, [fgQ.data]);

  const [catName, setCatName] = useState("");
  const [catIdEdit, setCatIdEdit] = useState<string | null>(null);
  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([]);
  const [catError, setCatError] = useState<string | null>(null);

  const [comboForm, setComboForm] = useState<{
    name: string;
    selling_price: string;
    groups: ComboGroupForm[];
  }>({
    name: "",
    selling_price: "",
    groups: [{ menu_category_id: "", quantity: "1" }],
  });
  const [preview, setPreview] = useState<unknown>(null);

  const menuItems = useMemo(() => menuQ.data ?? [], [menuQ.data]);
  const cats = catsQ.data ?? [];
  const combos = combosQ.data ?? [];
  const fgs = fgQ.data ?? [];
  const fgCats = fgCatQ.data ?? [];

  const menuNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of menuItems) {
      m.set(it.menuId, it.name);
      if (it.menuCode) m.set(it.menuCode, it.name);
    }
    return m;
  }, [menuItems]);

  function setLine(index: number, patch: Partial<LineForm>) {
    setLines((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  const createMenu = useMutation({
    mutationFn: (input: CreateMenuInput) => {
      if (!canEditMenu(useAuthStore.getState().user?.role)) {
        return Promise.reject(new Error("Only ADMIN can edit the menu"));
      }
      return menuApi.create(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu"] });
      setName("");
      setMenuCode("");
      setPosCategory("Mains");
      setSellingPrice("");
      setTaxRate("16");
      setLines([emptyFixed()]);
      setItemError(null);
    },
    onError: (err) =>
      setItemError(err instanceof ApiError ? err.message : "Create failed"),
  });


  const updateCatalog = useMutation({
    mutationFn: async (payload: {
      menuItemId: string;
      name: string;
      menu_code?: string | null;
      category?: string | null;
      selling_price: number;
      tax_rate?: number;
      active: boolean;
      is_available?: boolean;
      is_visible?: boolean;
      lines?: AdjustMenuBody["lines"];
      expected_updated_at?: string | null;
    }) => {
      if (!canEditMenu(useAuthStore.getState().user?.role)) {
        return Promise.reject(new Error("Only ADMIN can edit the menu"));
      }
      // Full domain edit via adjust (event-sourced menu_adjusted) — create field parity
      return adminEditApi.adjustMenu(payload.menuItemId, {
        name: payload.name,
        menu_code: payload.menu_code,
        category: payload.category,
        selling_price: payload.selling_price,
        tax_rate: payload.tax_rate,
        active: payload.active,
        is_available: payload.is_available ?? payload.active,
        is_visible: payload.is_visible ?? payload.active,
        lines: payload.lines,
        expected_updated_at: payload.expected_updated_at,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu"] });
      qc.invalidateQueries({ queryKey: ["pos"] });
      setEditOpen(false);
      setEditItem(null);
    },
  });

  function submitMenuItem() {
    setItemError(null);
    if (!name.trim()) {
      setItemError("Name is required");
      return;
    }
    const price = Number(sellingPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setItemError("Selling price must be positive");
      return;
    }
    if (lines.length === 0) {
      setItemError("Add at least one component");
      return;
    }
    const fgById = new Map(fgs.map((r) => [r.itemId, r] as const));
    const catById = new Map(fgCats.map((c) => [c.id || c.code, c] as const));
    for (const line of lines) {
      if (line.kind === "FIXED" && !line.finished_good_id.trim()) {
        setItemError("Each Fixed FG line needs a finished product");
        return;
      }
      if (
        line.kind === "CHOICE" &&
        line.option_item_ids.length === 0 &&
        !line.finished_good_category_id.trim()
      ) {
        setItemError(
          "Each Inventory Select needs at least one inventory item (or a legacy category)",
        );
        return;
      }
      const qty = Number(line.quantity_required);
      if (!Number.isFinite(qty) || qty <= 0) {
        setItemError("Component quantity must be positive");
        return;
      }
    }
    const payloadLines = lines.map((line, idx) => {
      if (line.kind === "CHOICE") {
        const cat = catById.get(line.finished_good_category_id);
        const option_items = line.option_item_ids.map((id) => {
          const fg = fgById.get(id);
          return {
            item_id: id,
            name: fg?.name ?? id,
            unit: fg?.unit ?? "pcs",
          };
        });
        return {
          component_type: "CHOICE" as const,
          component_key: `choice_${idx + 1}`,
          option_item_ids: line.option_item_ids,
          option_items,
          finished_good_category_id:
            line.finished_good_category_id.trim() || undefined,
          finished_good_category_code: cat?.code,
          finished_good_category_name: cat?.name,
          quantity_required: Number(line.quantity_required),
          unit: line.unit || "pcs",
          min_select: 1,
          max_select: Number(line.quantity_required) || 1,
        };
      }
      const fg = fgById.get(line.finished_good_id);
      return {
        component_type: "FIXED" as const,
        component_key: `fixed_${idx + 1}`,
        finished_good_id: line.finished_good_id,
        finished_good_name:
          line.finished_good_name || fg?.name || line.finished_good_id,
        quantity_required: Number(line.quantity_required),
        unit: line.unit || fg?.unit || "pcs",
      };
    });
    createMenu.mutate({
      name: name.trim(),
      menu_code: menuCode.trim() || undefined,
      category: posCategory.trim() || undefined,
      selling_price: price,
      tax_rate: Number(taxRate) || 16,
      lines: payloadLines,
    } as CreateMenuInput);
  }

  const saveCategory = useMutation({
    mutationFn: () =>
      menuApi.createCategory({
        name: catName.trim(),
        menu_item_ids: selectedMenuIds,
        ...(catIdEdit ? { category_id: catIdEdit } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-categories", shopId] });
      setCatName("");
      setCatIdEdit(null);
      setSelectedMenuIds([]);
      setCatError(null);
    },
    onError: (err) =>
      setCatError(err instanceof ApiError ? err.message : "Save failed"),
  });

  function startEditCategory(c: {
    categoryId: string;
    name: string;
    menuItemIds: string[];
  }) {
    setCatIdEdit(c.categoryId);
    setCatName(c.name);
    setSelectedMenuIds([...(c.menuItemIds ?? [])]);
    setCatError(null);
  }

  function toggleMenuInCategory(menuId: string) {
    setSelectedMenuIds((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId],
    );
  }

  const createCombo = useMutation({
    mutationFn: () =>
      menuApi.createCombo({
        name: comboForm.name,
        selling_price: Number(comboForm.selling_price),
        selection_groups: comboForm.groups.map((g) => ({
          menu_category_id: g.menu_category_id,
          quantity: Number(g.quantity) || 1,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-combos", shopId] });
      setComboForm({
        name: "",
        selling_price: "",
        groups: [{ menu_category_id: "", quantity: "1" }],
      });
    },
  });

  function updateGroup(idx: number, patch: Partial<ComboGroupForm>) {
    setComboForm((prev) => {
      const groups = prev.groups.map((g, i) => {
        if (i !== idx) return g;
        return {
          menu_category_id: patch.menu_category_id ?? g.menu_category_id,
          quantity: patch.quantity ?? g.quantity,
        };
      });
      return { ...prev, groups };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Catalog"
        description={
          canEdit
            ? "Multi-component menu items (Fixed FG + Choice pools), categories with visible members, and combos. POS lets cashiers pick products per category."
            : "Read-only catalog. Only administrators can create or edit menu items, categories, and combos."
        }
      />
      {!canEdit ? (
        <Alert
          tone="info"
          title="View only"
          description="You can browse the menu. Ask an admin to change items, categories, or combos."
        />
      ) : null}

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Menu items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="combos">Combos</TabsTrigger>
          <TabsTrigger value="preview">Trace / preview</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="flex flex-col gap-4">
          {canEdit ? (
          <Card>
            <CardHeader>
              <CardTitle>Create menu item (multi-component)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {itemError ? <Alert tone="danger" title={itemError} /> : null}
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Name (e.g. Classic Pizza Meal)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  placeholder="Menu code (optional)"
                  value={menuCode}
                  onChange={(e) => setMenuCode(e.target.value)}
                />
                <Input
                  placeholder="POS group (Mains, Combos…)"
                  value={posCategory}
                  onChange={(e) => setPosCategory(e.target.value)}
                />
                <Input
                  placeholder="Selling price"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                />
                <Input
                  placeholder="Tax %"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">Components</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setLines((p) => [...p, emptyFixed()])}
                    >
                      <Plus className="h-3.5 w-3.5" /> Fixed FG
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setLines((p) => [...p, emptyChoice()])}
                    >
                      <Plus className="h-3.5 w-3.5" /> Inventory select
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-ink-muted">
                  <strong>Fixed FG</strong> — always the same finished product
                  (e.g. always Fries). Deducted on sale.{" "}
                  <strong>Choice pool</strong> — cashier must pick from a{" "}
                  <em>finished-good category</em> (e.g. Sodas = Coke / Fanta /
                  Sprite). Create that category under finished goods, assign
                  products to it, then select it here. This is not the same as
                  POS screen groups (Mains / Combos).
                </p>
                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-12"
                  >
                    <div className="md:col-span-2">
                      <Badge
                        tone={line.kind === "FIXED" ? "success" : "neutral"}
                      >
                        {line.kind === "FIXED" ? "Fixed FG" : "Inv. select"}
                      </Badge>
                    </div>
                    {line.kind === "FIXED" ? (
                      <div className="md:col-span-5">
                        <SearchableSelect
                          value={line.finished_good_id}
                          onValueChange={(v) => {
                            const fg = fgs.find((x) => x.itemId === v);
                            setLine(idx, {
                              finished_good_id: v,
                              finished_good_name: fg?.name ?? "",
                              unit: fg?.unit ?? line.unit,
                            });
                          }}
                          options={fgSelectOptions}
                          placeholder="Select finished good…"
                          searchPlaceholder="Search name or SKU…"
                        />
                      </div>
                    ) : (
                      <div className="md:col-span-5 space-y-2">
                        <p className="text-xs text-ink-muted">
                          Search and pick stock SKUs from Inventory (not the finished-goods-only list).
                        </p>
                        <InventorySkuPicker
                          items={inventorySkuOptions}
                          selectedIds={line.option_item_ids}
                          mode="multi"
                          isLoading={invQ.isLoading}
                          serverSearch
                          searchValue={invSearch}
                          onSearchChange={setInvSearch}
                          totalAvailable={invQ.data?.total}
                          emptyTitle="No inventory SKUs"
                          emptyDescription="Type to search stock, or receive goods first."
                          onChange={(ids) =>
                            setLine(idx, { option_item_ids: ids })
                          }
                        />
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <Input
                        placeholder="Qty"
                        value={line.quantity_required}
                        onChange={(e) =>
                          setLine(idx, { quantity_required: e.target.value })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        placeholder="Unit"
                        value={line.unit}
                        onChange={(e) =>
                          setLine(idx, { unit: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-end md:col-span-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={lines.length <= 1}
                        onClick={() =>
                          setLines((p) => p.filter((_, i) => i !== idx))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                onClick={submitMenuItem}
                loading={createMenu.isPending}
                disabled={!name || !sellingPrice}
              >
                Create menu item
              </Button>
            </CardContent>
          </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Menu items</CardTitle>
            </CardHeader>
            {menuItems.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No menu items yet"
                description="Add Fixed FG and/or Choice pool components."
              />
            ) : (
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Components</TableHeaderCell>
                    <TableHeaderCell className="text-right">
                      Price
                    </TableHeaderCell>
                    <TableHeaderCell className="text-right">
                      COG
                    </TableHeaderCell>
                    <TableHeaderCell className="text-right">
                      Margin
                    </TableHeaderCell>
                    <TableHeaderCell className="text-right">
                      Food cost %
                    </TableHeaderCell>
                    {canEdit ? (
                      <TableHeaderCell className="text-right">
                        Action
                      </TableHeaderCell>
                    ) : null}
                  </tr>
                </TableHead>
                <TableBody>
                  {menuItems.map((it) => {
                    const foodPct =
                      it.foodCostPercent != null
                        ? it.foodCostPercent
                        : it.sellingPrice > 0
                          ? it.foodCost / it.sellingPrice
                          : null;
                    const marginPct =
                      it.marginPercent != null
                        ? it.marginPercent
                        : it.sellingPrice > 0
                          ? it.margin / it.sellingPrice
                          : null;
                    return (
                    <TableRow key={it.menuId}>
                      <TableCell className="font-medium">
                        {it.name}
                        <div className="text-xs text-ink-faint">
                          {it.menuId}
                        </div>
                        {it.costMissing ? (
                          <div className="mt-0.5 text-xs font-medium text-amber-600">
                            Cost missing on a component
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-ink-muted">
                        {(it.lines ?? []).length === 0
                          ? "—"
                          : (it.lines ?? [])
                              .map((l) =>
                                l.componentType === "CHOICE" ||
                                l.componentType === "MULTI_CHOICE"
                                  ? `Inv×${l.quantityRequired} (${
                                      l.finishedGoodCategoryName ||
                                      l.finishedGoodCategoryCode ||
                                      "select"
                                    })`
                                  : `Fixed ${l.finishedGoodName || l.finishedGoodId} ×${l.quantityRequired}`,
                              )
                              .join(" · ")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(it.sellingPrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {it.costMissing && it.foodCost <= 0
                          ? "—"
                          : formatCurrency(it.foodCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {it.costMissing && it.foodCost <= 0
                          ? "—"
                          : formatCurrency(it.margin)}
                        {marginPct != null && !(it.costMissing && it.foodCost <= 0) ? (
                          <div className="text-xs text-ink-muted">
                            {(marginPct * 100).toFixed(1)}%
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          foodPct != null && foodPct > 0.35
                            ? "font-medium text-red-600"
                            : ""
                        }`}
                      >
                        {foodPct == null || (it.costMissing && it.foodCost <= 0)
                          ? "—"
                          : `${(foodPct * 100).toFixed(1)}%`}
                      </TableCell>
                      {canEdit ? (
                        <TableCell className="text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditItem({
                                menuItemId: it.menuId,
                                name: it.name,
                                sellingPrice: it.sellingPrice,
                                active: it.isVisible !== false && it.isAvailable !== false,
                                menuCode: it.menuCode,
                                category: it.category,
                                taxRate: it.taxRate,
                                menu: it,
                                expectedUpdatedAt: it.createdAt ?? null,
                              });
                              setEditOpen(true);
                            }}
                          >
                            Adjust
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {catIdEdit ? "Edit category" : "Create category"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {catError ? <Alert tone="danger" title={catError} /> : null}
              <Input
                placeholder="Category name (e.g. Medium Pizza)"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
              <p className="text-xs text-ink-muted">
                Select menu items in this category (used by combos and POS).
                Click again to remove.
              </p>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-md border border-border p-3">
                {menuItems.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    Create menu items first.
                  </p>
                ) : (
                  menuItems.map((m) => {
                    const on = selectedMenuIds.includes(m.menuId);
                    return (
                      <Button
                        key={m.menuId}
                        size="sm"
                        variant={on ? "primary" : "secondary"}
                        onClick={() => toggleMenuInCategory(m.menuId)}
                      >
                        {m.name}
                      </Button>
                    );
                  })
                )}
              </div>
              {selectedMenuIds.length > 0 ? (
                <p className="text-xs text-ink-muted">
                  Selected ({selectedMenuIds.length}):{" "}
                  {selectedMenuIds
                    .map((id) => menuNameById.get(id) || id)
                    .join(", ")}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (!catName.trim()) {
                      setCatError("Name is required");
                      return;
                    }
                    saveCategory.mutate();
                  }}
                  loading={saveCategory.isPending}
                >
                  {catIdEdit ? "Save category" : "Create category"}
                </Button>
                {catIdEdit ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCatIdEdit(null);
                      setCatName("");
                      setSelectedMenuIds([]);
                    }}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            {cats.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No categories"
                description="Categories are selection pools of menu items."
              />
            ) : (
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Menu items</TableHeaderCell>
                    <TableHeaderCell />
                  </tr>
                </TableHead>
                <TableBody>
                  {cats.map((c) => {
                    const memberNames =
                      (
                        c as {
                          menuItems?: Array<{
                            menuItemId: string;
                            name: string;
                          }>;
                        }
                      ).menuItems ?? [];
                    const ids = c.menuItemIds ?? [];
                    return (
                      <TableRow key={c.categoryId}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-sm text-ink-muted">
                          {ids.length === 0 && memberNames.length === 0 ? (
                            "—"
                          ) : (
                            <ul className="list-inside list-disc">
                              {(memberNames.length > 0
                                ? memberNames.map((m) => m.name || m.menuItemId)
                                : ids.map(
                                    (id) => menuNameById.get(id) || id,
                                  )
                              ).map((label, i) => (
                                <li key={`${label}-${i}`}>{label}</li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => startEditCategory(c)}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="combos" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Create combo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Input
                placeholder="Combo name"
                value={comboForm.name}
                onChange={(e) =>
                  setComboForm({ ...comboForm, name: e.target.value })
                }
              />
              <Input
                placeholder="Selling price"
                value={comboForm.selling_price}
                onChange={(e) =>
                  setComboForm({
                    ...comboForm,
                    selling_price: e.target.value,
                  })
                }
              />
              {comboForm.groups.map((g, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-2">
                  <select
                    className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
                    value={g.menu_category_id}
                    onChange={(e) =>
                      updateGroup(idx, { menu_category_id: e.target.value })
                    }
                  >
                    <option value="">Select category</option>
                    {cats.map((c) => (
                      <option key={c.categoryId} value={c.categoryId}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Quantity"
                    value={g.quantity}
                    onChange={(e) =>
                      updateGroup(idx, { quantity: e.target.value })
                    }
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setComboForm({
                      ...comboForm,
                      groups: [
                        ...comboForm.groups,
                        { menu_category_id: "", quantity: "1" },
                      ],
                    })
                  }
                >
                  Add group
                </Button>
                <Button
                  onClick={() => createCombo.mutate()}
                  loading={createCombo.isPending}
                  disabled={!comboForm.name || !comboForm.selling_price}
                >
                  Create combo
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Combos</CardTitle>
            </CardHeader>
            {combos.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No combos"
                description="A combo is only a price + selection rules."
              />
            ) : (
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell className="text-right">
                      Price
                    </TableHeaderCell>
                    <TableHeaderCell>Rules</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {combos.map((c) => (
                    <TableRow key={c.comboId}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(c.sellingPrice)}
                      </TableCell>
                      <TableCell className="text-ink-muted text-sm">
                        {c.selectionGroups
                          .map(
                            (g) =>
                              `${g.quantity}× ${g.menuCategoryName || g.menuCategoryId}`,
                          )
                          .join(" · ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Combo stock impact preview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">
                Same resolution engine as POS — does not mutate stock.
              </p>
              <Button
                variant="secondary"
                disabled={!combos[0]}
                onClick={async () => {
                  const c = combos[0];
                  if (!c) return;
                  const selections = c.selectionGroups.map((g) => ({
                    group_index: g.groupIndex,
                    menu_item_ids: (
                      cats.find((x) => x.categoryId === g.menuCategoryId)
                        ?.menuItemIds ?? []
                    ).slice(0, g.quantity),
                  }));
                  const data = await menuApi.previewCombo({
                    combo_id: c.comboId,
                    quantity: 1,
                    selections,
                  });
                  setPreview(data);
                }}
              >
                Preview first combo (sample picks)
              </Button>
              {preview ? (
                <pre className="overflow-auto rounded-lg bg-surface-muted p-3 text-xs">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditCatalogItemModal
        item={editItem}
        open={editOpen}
        shopId={shopId}
        allMenuNames={menuItems.map((m) => m.name)}
        onClose={() => {
          setEditOpen(false);
          setEditItem(null);
        }}
        onSave={async (patch) => {
          if (!editItem) return;
          await updateCatalog.mutateAsync({
            menuItemId: editItem.menuItemId,
            ...patch,
          });
        }}
      />

    </div>
  );
}
