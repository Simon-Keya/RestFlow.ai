// apps/web/src/features/inventory/components/InventoryPage.tsx
"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { ErrorState } from "@/components/ui/ErrorState";
import { RoleGate } from "@/components/layout/RoleGate";

import { useInventory } from "../hooks/use-inventory";
import { useInventoryAlerts } from "../hooks/use-inventory-alerts";
import { useInventoryFilters } from "../hooks/use-inventory-filters";
import { inventoryApi } from "../api";
import { receiveGoodsSchema, type ReceiveGoodsInput } from "../schema";
import { InventorySummary } from "./InventorySummary";
import { InventoryFilters } from "./InventoryFilters";
import { InventoryTable } from "./InventoryTable";
import { LowStockBanner } from "./LowStockBanner";
import { InventorySkeleton } from "./InventorySkeleton";
import { useToast } from "@/providers/ToastProvider";
import { useDebounce } from "@/hooks/use-debounce";

import { ApiError } from "@/lib/api/errors";
import {
  INGREDIENT_CATEGORY_GROUPS,
  INGREDIENT_CATEGORIES,
  DEFAULT_CATEGORY,
  type IngredientCategory,
} from "@/lib/catalog/ingredient-categories";
import {
  INVENTORY_UNITS,
  DEFAULT_INVENTORY_UNIT,
} from "@/lib/catalog/inventory-units";

const PAGE_SIZE = 20;

function dateOnlyToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function isIngredientCategory(value: string): value is IngredientCategory {
  return (INGREDIENT_CATEGORIES as readonly string[]).includes(value);
}

type ReceiveFormState = {
  item_id: string;
  item_name: string;
  units: string;
  category: IngredientCategory;
  quantity: string;
  quantity_approved: string;
  quantity_rejected: string;
  date_received: string;
  expiry_date: string;
  unit_cost: string;
  total_cost: string;
  supplier_name: string;
  supplier_number: string;
  supplier_id: string;
  approved_by: string;
  batch_number: string;
};

const EMPTY_RECEIVE_FORM: ReceiveFormState = {
  item_id: "",
  item_name: "",
  units: DEFAULT_INVENTORY_UNIT,
  category: DEFAULT_CATEGORY,
  quantity: "",
  quantity_approved: "",
  quantity_rejected: "0",
  date_received: dateOnlyToday(),
  expiry_date: "",
  unit_cost: "",
  total_cost: "",
  supplier_name: "",
  supplier_number: "",
  supplier_id: "",
  approved_by: "",
  batch_number: "",
};

function ReceiveStockModal({
  shopId,
  open,
  onOpenChange,
}: {
  shopId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<ReceiveFormState>({ ...EMPTY_RECEIVE_FORM });
  const [error, setError] = useState<string | null>(null);
  /** Which field last opened the typeahead: name or sku */
  const [suggestField, setSuggestField] = useState<"name" | "sku" | null>(null);
  const [nearMatch, setNearMatch] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Suggest from either name or SKU (item_id) — Michael: match both
  const debouncedName = useDebounce(form.item_name.trim(), 200);
  const debouncedSku = useDebounce(form.item_id.trim(), 200);
  const suggestQuery =
    suggestField === "sku"
      ? debouncedSku
      : suggestField === "name"
        ? debouncedName
        : debouncedName || debouncedSku;

  const suggestQ = useQuery({
    queryKey: ["inventory", "suggest", shopId, suggestQuery],
    queryFn: () =>
      inventoryApi.list({
        shopId,
        search: suggestQuery,
        pageSize: 8,
      }),
    enabled: open && suggestQuery.length >= 1,
  });

  const suggestions = (suggestQ.data?.items ?? suggestQ.data ?? []) as Array<{
    itemId?: string;
    item_id?: string;
    name?: string;
    itemName?: string;
    category?: string;
    unit?: string;
    units?: string;
  }>;

  function applySuggestion(s: (typeof suggestions)[0]) {
    const id = s.itemId || s.item_id || "";
    const name = s.name || s.itemName || "";
    const cat = s.category || form.category;
    const unit = s.unit || s.units || form.units;
    setForm((prev) => ({
      ...prev,
      item_id: id,
      item_name: name,
      category: cat as typeof prev.category,
      units: unit,
    }));
    setSuggestField(null);
    setNearMatch(null);
  }

  useEffect(() => {
    const approvedRaw =
      form.quantity_approved.trim() !== ""
        ? form.quantity_approved
        : form.quantity;
    const approvedQty = Number(approvedRaw);
    const unitCost = Number(form.unit_cost);
    if (
      Number.isFinite(approvedQty) &&
      approvedQty > 0 &&
      Number.isFinite(unitCost) &&
      unitCost >= 0
    ) {
      setForm((prev) => ({
        ...prev,
        total_cost: (approvedQty * unitCost).toFixed(2),
      }));
    }
  }, [form.quantity, form.quantity_approved, form.unit_cost]);

  const mutation = useMutation({
    mutationFn: (input: ReceiveGoodsInput) => inventoryApi.receiveGoods(input),
    onSuccess: () => {
      toast({
        title: "Stock received",
        description: `${form.quantity} ${form.units} logged against batch ${form.batch_number}.`,
        variant: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({
        queryKey: ["inventory", "summary"],
      });
      onOpenChange(false);
      setForm({
        ...EMPTY_RECEIVE_FORM,
        date_received: dateOnlyToday(),
      });
      setError(null);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't record this receipt.",
      ),
  });

  function handleSubmit() {
    const result = receiveGoodsSchema.safeParse(form);
    if (!result.success) {
      setError(
        result.error.issues[0]?.message ?? "Check the form and try again.",
      );
      return;
    }
    setError(null);
    mutation.mutate(result.data);
  }

  function handleCategoryChange(value: string) {
    if (!isIngredientCategory(value)) return;
    setForm((prev) => ({ ...prev, category: value }));
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Receive goods (GRN)"
      description={`Log a delivery into shop ${shopId}'s inventory — same fields as mobile.`}
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={mutation.isPending}>
            Submit receive
          </Button>
        </>
      }
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
        {error ? <Alert tone="danger" title={error} /> : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Item ID / SKU *
            </label>
            <Input
              value={form.item_id}
              onChange={(e) => {
                setForm({ ...form, item_id: e.target.value });
                setSuggestField("sku");
                setNearMatch(null);
              }}
              onFocus={() => setSuggestField("sku")}
              placeholder="Type SKU or code (e.g. ST300)"
            />
            {suggestField === "sku" &&
            suggestQuery.length >= 1 &&
            suggestions.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-white shadow-lg">
                {suggestions.map((s) => {
                  const id = s.itemId || s.item_id || "";
                  const name = s.name || s.itemName || id;
                  return (
                    <button
                      key={`sku-${id}`}
                      type="button"
                      className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-surface-muted"
                      onClick={() => applySuggestion(s)}
                    >
                      <span className="font-medium tabular-nums">{id}</span>
                      <span className="text-xs text-ink-muted">
                        {name}
                        {s.category ? ` · ${s.category}` : ""}
                        {s.unit || s.units ? ` · ${s.unit || s.units}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Item name *
            </label>
            <Input
              value={form.item_name}
              onChange={(e) => {
                setForm({ ...form, item_name: e.target.value });
                setSuggestField("name");
                setNearMatch(null);
              }}
              onFocus={() => setSuggestField("name")}
              placeholder="Type name to search previous SKUs…"
            />
            {suggestField === "name" &&
            suggestQuery.length >= 1 &&
            suggestions.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-white shadow-lg">
                {suggestions.map((s) => {
                  const id = s.itemId || s.item_id || "";
                  const name = s.name || s.itemName || id;
                  return (
                    <button
                      key={`name-${id}`}
                      type="button"
                      className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-surface-muted"
                      onClick={() => applySuggestion(s)}
                    >
                      <span className="font-medium">{name}</span>
                      <span className="text-xs text-ink-muted">
                        {id}
                        {s.category ? ` · ${s.category}` : ""}
                        {s.unit || s.units ? ` · ${s.unit || s.units}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {nearMatch ? (
              <p className="mt-1 text-xs text-amber-700">
                Did you mean{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => {
                    const match = suggestions.find(
                      (s) =>
                        (s.name || s.itemName || "").toUpperCase() ===
                        nearMatch.toUpperCase(),
                    );
                    if (match) applySuggestion(match);
                  }}
                >
                  {nearMatch}
                </button>
                ?
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Category *
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
              value={form.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              {INGREDIENT_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.items.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Units *
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
              value={form.units}
              onChange={(e) => setForm({ ...form, units: e.target.value })}
            >
              {INVENTORY_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-ink-muted">
          Reorder point defaults to ~20% of approved qty when not set (per item, fixed threshold).
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Qty received *
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Qty approved
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.quantity_approved}
              onChange={(e) =>
                setForm({ ...form, quantity_approved: e.target.value })
              }
              placeholder="Defaults to received"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Qty rejected
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.quantity_rejected}
              onChange={(e) =>
                setForm({ ...form, quantity_rejected: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Date received *
            </label>
            <Input
              type="date"
              value={form.date_received}
              onChange={(e) =>
                setForm({ ...form, date_received: e.target.value })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Expiry date *
            </label>
            <Input
              type="date"
              value={form.expiry_date}
              onChange={(e) =>
                setForm({ ...form, expiry_date: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Unit cost (KES) * — required for inventory value
            </label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.unit_cost}
              onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
            />
            {!form.unit_cost || Number(form.unit_cost) <= 0 ? (
              <p className="mt-1 text-xs text-danger">
                Enter cost per unit so Value is not Ksh 0.00
              </p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Total cost (KES)
            </label>
            <Input
              value={form.total_cost}
              readOnly
              className="bg-surface-muted"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Batch number *
            </label>
            <Input
              value={form.batch_number}
              onChange={(e) =>
                setForm({ ...form, batch_number: e.target.value })
              }
              placeholder="BATCH-2026-001"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Supplier name
            </label>
            <Input
              value={form.supplier_name}
              onChange={(e) =>
                setForm({ ...form, supplier_name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Supplier number
            </label>
            <Input
              value={form.supplier_number}
              onChange={(e) =>
                setForm({ ...form, supplier_number: e.target.value })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Supplier ID
            </label>
            <Input
              value={form.supplier_id}
              onChange={(e) =>
                setForm({ ...form, supplier_id: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Approved by
          </label>
          <Input
            value={form.approved_by}
            onChange={(e) => setForm({ ...form, approved_by: e.target.value })}
            placeholder="e.g. DONDO"
          />
        </div>
      </div>
    </Modal>
  );
}

export function InventoryPage({ shopId }: { shopId: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const filters = useInventoryFilters();

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.category, filters.status]);

  const expiryAlerts = useQuery({
    queryKey: ["inventory", "expiry-alerts", shopId],
    queryFn: () => inventoryApi.getExpiryAlerts(shopId),
    refetchInterval: 60_000,
  });

  const inventory = useInventory({
    shopId,
    ...filters.queryParams,
    page,
    pageSize: PAGE_SIZE,
  });
  const alerts = useInventoryAlerts(shopId);

  const summary = useQuery({
    queryKey: ["inventory", "summary", shopId],
    queryFn: () => inventoryApi.getSummary(shopId),
    staleTime: 30_000,
  });

  if (inventory.isPending) return <InventorySkeleton />;

  if (inventory.isError) {
    return (
      <ErrorState
        title="Couldn't load inventory"
        description={inventory.error.message}
        onRetry={inventory.refetch}
      />
    );
  }

  const total = inventory.data.total ?? 0;
  const pageSize = inventory.data.pageSize ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(inventory.data.page ?? page, totalPages);

  const summaryData = {
    totalItems: summary.data?.totalItems ?? total,
    totalValue: summary.data?.totalValue ?? 0,
    lowOrOutCount: summary.data?.lowOrOutCount ?? 0,
    expiredCount: summary.data?.expiredCount ?? 0,
    expiredValueAtRisk: summary.data?.expiredValueAtRisk ?? 0,
    expiringIn7DaysCount: summary.data?.expiringIn7DaysCount ?? 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory"
        description="Live stock levels across every tracked item."
        actions={
          <RoleGate allow={["ADMIN", "MANAGER", "KITCHEN"]}>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Receive stock
            </Button>
          </RoleGate>
        }
      />

      <LowStockBanner items={alerts.data ?? []} />

      <InventorySummary
        data={summaryData}
        activeStatus={filters.status || "all"}
        onStatusClick={(status) => {
          if (status === "all") {
            filters.setStatus("");
          } else {
            filters.setStatus(status);
          }
          setPage(1);
        }}
      />

      {expiryAlerts.data && expiryAlerts.data.length > 0 ? <Alert tone="warning" title={`${expiryAlerts.data.filter((row) => row.daysToExpiry < 0).length} expired batch(es) pending write-off · ${expiryAlerts.data.filter((row) => row.daysToExpiry >= 0).length} batch(es) expiring within 7 days`} description={expiryAlerts.data.slice(0, 4).map((row) => `${row.itemName} (${row.batchNumber}): ${row.quantity} ${row.unit}, ${row.daysToExpiry < 0 ? `expired ${Math.abs(row.daysToExpiry)} day(s) ago` : row.daysToExpiry === 0 ? 'expires today' : `${row.daysToExpiry} day(s) left`}`).join(' · ')} /> : null}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <InventoryFilters
            search={filters.search}
            onSearchChange={filters.setSearch}
            category={filters.category}
            onCategoryChange={filters.setCategory}
            status={filters.status}
            onStatusChange={filters.setStatus}
          />
        </div>
        <InventoryTable
          shopId={shopId}
          items={inventory.data.items}
          isLoading={inventory.isFetching}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-xs text-ink-muted">
            Page {currentPage} of {totalPages} · {total} items · {pageSize} per
            page
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage <= 1 || inventory.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage >= totalPages || inventory.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <ReceiveStockModal
        shopId={shopId}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
