"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { dedupeMenuLines } from "./dedupeMenuLines";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";

import { menuApi } from "@/features/menu/api";
import type { MenuComponentLine, MenuItem } from "@/features/menu/types";
import { formatCurrency } from "@/lib/format/currency";
import { ApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/ToastProvider";
import {
  posApi,
  type ComponentSelectionInput,
  type CreatePosOrderInput,
  type PaymentSplitInput,
} from "../api";
import { ComboPicker } from "./ComboPicker";

type CartSelection = ComponentSelectionInput;

type CartLine = {
  key: string;
  menu: MenuItem;
  quantity: number;
  selections: CartSelection[];
};

type ComboCartLine = {
  key: string;
  combo_id: string;
  name: string;
  selling_price: number;
  quantity: number;
  combo_selections: Array<{ group_index: number; menu_item_ids: string[] }>;
};

type SplitRow = {
  method: "cash" | "mpesa" | "card";
  amount: string;
  reference: string;
};

function requiredUnits(component: MenuComponentLine, soldQty: number) {
  return component.quantityRequired * soldQty;
}

function selectionTotal(selections: CartSelection[], componentKey: string) {
  return selections
    .filter((s) => s.component_key === componentKey)
    .reduce((sum, s) => sum + s.quantity, 0);
}

function validateLine(line: CartLine): string | null {
  for (const component of line.menu.lines) {
    if (component.componentType === "FIXED" || component.componentType === "INVENTORY") continue;
    const need = requiredUnits(component, line.quantity);
    const got = selectionTotal(line.selections, component.componentKey);
    if (got !== need) {
      return `${line.menu.name}: ${component.finishedGoodCategoryName || component.componentKey} needs ${need}, got ${got}`;
    }
  }
  return null;
}

const emptySplit = (): SplitRow => ({
  method: "cash",
  amount: "",
  reference: "",
});

export function NewOrderPanel({ shopId }: { shopId: string }) {
  const [open, setOpen] = useState(false);
  const [orderType, setOrderType] =
    useState<CreatePosOrderInput["order_type"]>("dine_in");
  const [paymentMethod, setPaymentMethod] =
    useState<CreatePosOrderInput["payment_method"]>("cash");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [mpesaReference, setMpesaReference] = useState("");
  const [splits, setSplits] = useState<SplitRow[]>([
    emptySplit(),
    { method: "mpesa", amount: "", reference: "" },
  ]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [comboCart, setComboCart] = useState<ComboCartLine[]>([]);
  const [activeMenu, setActiveMenu] = useState<MenuItem | null>(null);
  const [draftQty, setDraftQty] = useState(1);
  const [draftSelections, setDraftSelections] = useState<CartSelection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [posSearch, setPosSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQ, setDebouncedQ] = useState("");
  /** When set, ComboPicker opens that combo (from POS search). */
  const [openComboId, setOpenComboId] = useState<string | null>(null);


  const queryClient = useQueryClient();
  const { toast } = useToast();

  const menuQuery = useQuery({
    queryKey: ["pos", "bootstrap", "menus", shopId],
    queryFn: async (): Promise<MenuItem[]> => {
      try {
        const boot = await posApi.getBootstrap(shopId);
        if (boot.menus?.length) {
          return boot.menus as MenuItem[];
        }
      } catch {
        /* fall back to catalog list */
      }
      const listed = await menuApi.list(shopId);
      if (Array.isArray(listed)) return listed;
      const nested = listed as { items?: MenuItem[] };
      return Array.isArray(nested?.items) ? nested.items : [];
    },
    enabled: open,
  });


  const combosQuery = useQuery({
    queryKey: ["pos", "combos", shopId],
    queryFn: () => menuApi.listCombos(shopId),
    enabled: open,
  });
  const total = useMemo(() => {
    const menuTotal = cart.reduce(
      (sum, line) => sum + line.menu.sellingPrice * line.quantity,
      0,
    );
    const comboTotal = comboCart.reduce(
      (sum, line) => sum + line.selling_price * line.quantity,
      0,
    );
    return menuTotal + comboTotal;
  }, [cart, comboCart]);

  const splitSum = useMemo(
    () =>
      splits.reduce((s, row) => {
        const n = Number(row.amount);
        return s + (Number.isFinite(n) ? n : 0);
      }, 0),
    [splits],
  );

  const splitRemaining = Math.round((total - splitSum) * 100) / 100;

  const createMutation = useMutation({
    mutationFn: (input: CreatePosOrderInput) => posApi.createOrder(input),
    onSuccess: (res) => {
      toast({
        title: "Order placed",
        description: res.orderId ? `Order ${res.orderId}` : undefined,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["pos"] });
      setCart([]);
      setComboCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setTableNumber("");
      setMpesaReference("");
      setPaymentMethod("cash");
      setSplits([emptySplit(), { method: "mpesa", amount: "", reference: "" }]);
      setOpen(false);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not place order");
    },
  });

  function openChooser(menu: MenuItem) {
    setActiveMenu(menu);
    setDraftQty(1);
    setDraftSelections([]);
    setError(null);
  }

  /** One-tap select: same mental model as FIXED FG — fills remaining need for this component. */
  function selectChoiceOption(
    component: MenuComponentLine,
    optionId: string,
    optionName: string,
    availableStock: number,
  ) {
    const need = requiredUnits(component, draftQty);
    setDraftSelections((prev) => {
      const withoutThisComponent = prev.filter(
        (s) => s.component_key !== component.componentKey,
      );
      const already = prev
        .filter((s) => s.component_key === component.componentKey)
        .reduce((sum, s) => sum + s.quantity, 0);
      // Toggle off if same option already fully selected
      const existing = prev.find(
        (s) =>
          s.component_key === component.componentKey &&
          s.finished_good_id === optionId,
      );
      if (existing && already >= need) {
        return withoutThisComponent;
      }
      // Single-option fill: assign full remaining need to this FG (capped by stock)
      const qty = Math.min(need, Math.max(0, availableStock || need));
      if (qty <= 0) return withoutThisComponent;
      return [
        ...withoutThisComponent,
        {
          component_key: component.componentKey,
          finished_good_id: optionId,
          finished_good_name: optionName,
          quantity: qty,
        },
      ];
    });
  }

  function addDraftToCart() {
    if (!activeMenu) return;
    const line: CartLine = {
      key: `${activeMenu.menuId}-${Date.now()}`,
      menu: activeMenu,
      quantity: draftQty,
      selections: draftSelections,
    };
    const problem = validateLine(line);
    if (problem) {
      setError(problem);
      return;
    }
    setCart((prev) => [...prev, line]);
    setActiveMenu(null);
    setError(null);
  }

  function submitOrder() {
    for (const line of cart) {
      const problem = validateLine(line);
      if (problem) {
        setError(problem);
        return;
      }
    }
    if (cart.length === 0 && comboCart.length === 0) {
      setError("Add at least one item");
      return;
    }
    if (total <= 0) {
      setError("Order total must be positive");
      return;
    }

    let payment_splits: PaymentSplitInput[] | undefined;
    if (paymentMethod === "split") {
      const cleaned = splits
        .map((row) => ({
          method: row.method,
          amount: Number(row.amount),
          reference: row.reference.trim() || undefined,
        }))
        .filter((row) => Number.isFinite(row.amount) && row.amount > 0);

      if (cleaned.length < 2) {
        setError("Split payment needs at least two lines with amounts");
        return;
      }
      const sum = cleaned.reduce((s, r) => s + r.amount, 0);
      if (Math.abs(sum - total) > 0.02) {
        setError(
          `Split total ${formatCurrency(sum)} must equal order ${formatCurrency(total)}`,
        );
        return;
      }
      payment_splits = cleaned;
    }

    const clientKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    createMutation.mutate({
      shop_id: shopId,
      client_idempotency_key: clientKey,
      order_type: orderType,
      table_number: tableNumber.trim() || undefined,
      customer_name: customerName.trim() || undefined,
      customer_phone: customerPhone.trim() || undefined,
      payment_method: paymentMethod,
      payment_splits,
      mpesa_reference:
        paymentMethod === "mpesa"
          ? mpesaReference.trim() || undefined
          : payment_splits?.find((s) => s.method === "mpesa")?.reference,
      payment_status: "paid",
      total_amount: total,
      tax_amount: 0,
      discount_amount: 0,
      items: [
        ...cart.map((line) => ({
          line_type: "menu_item" as const,
          menu_id: line.menu.menuId,
          menu_name: line.menu.name,
          quantity: line.quantity,
          selling_price: line.menu.sellingPrice,
          selections: line.selections,
        })),
        ...comboCart.map((line) => ({
          line_type: "combo" as const,
          combo_id: line.combo_id,
          menu_id: line.combo_id,
          menu_name: line.name,
          quantity: line.quantity,
          selling_price: line.selling_price,
          combo_selections: line.combo_selections,
        })),
      ],
    });
  }


  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(posSearch.trim()), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [posSearch]);

  const menus = (menuQuery.data ?? []).filter((m) => m.isVisible !== false);

  /** Light typo tolerance: allow 1-char edit distance for short queries */
  function fuzzyMatch(name: string, q: string): boolean {
    const n = name.toLowerCase();
    const query = q.toLowerCase();
    if (n.includes(query)) return true;
    // word-boundary partial
    const words = n.split(/\s+/);
    if (words.some((w) => w.startsWith(query) || query.split(/\s+/).every((qw) => n.includes(qw)))) return true;
    // simple 1-edit for length >= 4
    if (query.length >= 4 && query.length <= n.length + 1) {
      let mismatches = 0;
      let j = 0;
      for (let i = 0; i < query.length && j < n.length; i++) {
        if (query[i] === n[j]) { j++; continue; }
        mismatches++;
        if (mismatches > 1) return false;
        // try skip in query or name
        if (i + 1 < query.length && query[i + 1] === n[j]) continue;
        j++;
        i--;
      }
      return mismatches <= 1;
    }
    return false;
  }

  type SearchHit = {
    kind: "item" | "combo";
    id: string;
    name: string;
    price: number;
    category?: string;
    available: boolean;
    menu?: MenuItem;
    combo?: { comboId: string; name: string; sellingPrice: number };
  };


  function selectSearchHit(hit: {
    kind: "item" | "combo";
    id: string;
    name: string;
    price: number;
    available: boolean;
    menu?: MenuItem;
    combo?: { comboId: string; name: string; sellingPrice: number };
  }) {
    if (!hit.available) return;
    if (hit.kind === "item" && hit.menu) {
      openChooser(hit.menu);
    } else if (hit.kind === "combo" && hit.combo) {
      // Close search and auto-open ComboPicker on the chosen combo
      setOpenComboId(hit.combo.comboId);
    }
    setPosSearch("");
    setSearchOpen(false);
  }

  const searchResults = useMemo((): SearchHit[] => {
    const q = debouncedQ;
    if (q.length < 1) return [];
    const hits: SearchHit[] = [];
    for (const m of menus) {
      if (!fuzzyMatch(m.name, q)) continue;
      hits.push({
        kind: "item",
        id: m.menuId,
        name: m.name,
        price: m.sellingPrice,
        category: m.category || undefined,
        available: (m.maxPortions ?? 1) > 0 && m.isAvailable !== false,
        menu: m,
      });
    }
    const combos = combosQuery.data ?? [];
    for (const c of combos) {
      if (!fuzzyMatch(c.name, q)) continue;
      hits.push({
        kind: "combo",
        id: c.comboId,
        name: c.name,
        price: c.sellingPrice,
        category: "Combo",
        available: true,
        combo: c,
      });
    }
    // rank: prefix first, then substring
    const ql = q.toLowerCase();
    hits.sort((a, b) => {
      const ap = a.name.toLowerCase().startsWith(ql) ? 0 : 1;
      const bp = b.name.toLowerCase().startsWith(ql) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    });
    return hits.slice(0, 10);
  }, [debouncedQ, menus, combosQuery.data]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [debouncedQ]);


  const showTable =
    orderType === "dine_in" || orderType === "dine-in";

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New order
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="New POS order"
        className="max-w-3xl"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitOrder}
              loading={createMutation.isPending}
              disabled={
                (cart.length === 0 && comboCart.length === 0) ||
                (paymentMethod === "split" && Math.abs(splitRemaining) > 0.02)
              }
            >
              Charge {formatCurrency(total)}
            </Button>
          </>
        }
      >
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          {error ? <Alert tone="danger" title={error} /> : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                Order type
              </label>
              <Select
                value={orderType}
                onValueChange={(v) =>
                  setOrderType(v as CreatePosOrderInput["order_type"])
                }
                options={[
                  { value: "dine_in", label: "Dine in" },
                  { value: "takeaway", label: "Takeaway" },
                  { value: "delivery", label: "Delivery" },
                  { value: "pickup", label: "Pickup" },
                ]}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                Payment
              </label>
              <Select
                value={paymentMethod}
                onValueChange={(v) =>
                  setPaymentMethod(
                    v as CreatePosOrderInput["payment_method"],
                  )
                }
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "mpesa", label: "M-Pesa" },
                  { value: "card", label: "Card" },
                  { value: "split", label: "Split" },
                ]}
              />
            </div>
            {showTable ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">
                  Table
                </label>
                <Input
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
            ) : (
              <div />
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                Customer name
              </label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                Customer phone
              </label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="07… or 254…"
              />
            </div>
          </div>

          {paymentMethod === "mpesa" ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                M-Pesa reference (optional)
              </label>
              <Input
                value={mpesaReference}
                onChange={(e) => setMpesaReference(e.target.value)}
                placeholder="Receipt / till ref"
              />
            </div>
          ) : null}

          {paymentMethod === "split" ? (
            <Card>
              <CardHeader>
                <CardTitle>Split payment</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-xs text-ink-muted">
                  Amounts must total {formatCurrency(total)}. Remaining:{" "}
                  <span
                    className={
                      Math.abs(splitRemaining) < 0.02
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }
                  >
                    {formatCurrency(splitRemaining)}
                  </span>
                </p>
                {splits.map((row, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 rounded-md border border-border p-2"
                  >
                    <div className="col-span-4">
                      <Select
                        value={row.method}
                        onValueChange={(v) =>
                          setSplits((prev) =>
                            prev.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    method: v as SplitRow["method"],
                                  }
                                : r,
                            ),
                          )
                        }
                        options={[
                          { value: "cash", label: "Cash" },
                          { value: "mpesa", label: "M-Pesa" },
                          { value: "card", label: "Card" },
                        ]}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount"
                        value={row.amount}
                        onChange={(e) =>
                          setSplits((prev) =>
                            prev.map((r, i) =>
                              i === index
                                ? { ...r, amount: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        placeholder="Ref (optional)"
                        value={row.reference}
                        onChange={(e) =>
                          setSplits((prev) =>
                            prev.map((r, i) =>
                              i === index
                                ? { ...r, reference: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="col-span-1 flex items-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={splits.length <= 2}
                        onClick={() =>
                          setSplits((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setSplits((prev) => [...prev, emptySplit()])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add tender
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Menu</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="relative">
                <Input
                  ref={searchRef}
                  placeholder="Search menu items & combos…"
                  value={posSearch}
                  onChange={(e) => {
                    setPosSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (!searchOpen || searchResults.length === 0) {
                      if (e.key === "Escape") setSearchOpen(false);
                      return;
                    }
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightIdx((i) => Math.min(i + 1, searchResults.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightIdx((i) => Math.max(i - 1, 0));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      const hit = searchResults[highlightIdx];
                      if (hit) selectSearchHit(hit);
                    } else if (e.key === "Escape") {
                      setSearchOpen(false);
                      setPosSearch("");
                    }
                  }}
                  className="w-full"
                  autoFocus
                />
                {searchOpen && debouncedQ.length >= 1 ? (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-white shadow-lg">
                    {searchResults.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-ink-muted">
                        No menu item or combo found
                      </p>
                    ) : (
                      searchResults.map((hit, idx) => (
                        <button
                          key={`${hit.kind}-${hit.id}`}
                          type="button"
                          disabled={!hit.available}
                          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                            idx === highlightIdx ? "bg-primary-50" : ""
                          } ${!hit.available ? "opacity-40" : "hover:bg-surface-muted"}`}
                          onMouseEnter={() => setHighlightIdx(idx)}
                          onClick={() => hit.available && selectSearchHit(hit)}
                        >
                          <div>
                            <span className="font-medium text-ink">{hit.name}</span>
                            <span className="ml-2 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-ink-muted">
                              {hit.kind === "combo" ? "Combo" : "Item"}
                            </span>
                            {hit.category ? (
                              <span className="ml-1 text-xs text-ink-faint">
                                {hit.category}
                              </span>
                            ) : null}
                            {!hit.available ? (
                              <span className="ml-2 text-xs text-red-600">
                                Unavailable
                              </span>
                            ) : null}
                          </div>
                          <span className="tabular-nums text-ink-muted">
                            {formatCurrency(hit.price)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              {menuQuery.isPending ? (
                <p className="text-sm text-ink-muted">Loading menu…</p>
              ) : menus.length === 0 ? (
                <p className="text-sm text-ink-muted">No menu items yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                {menus.map((menu) => (
                  <button
                    key={menu.menuId}
                    type="button"
                    disabled={menu.maxPortions <= 0 || !menu.isAvailable}
                    onClick={() => openChooser(menu)}
                    className="rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary-500 disabled:opacity-40"
                  >
                    <div className="font-medium text-ink">{menu.name}</div>
                    <div className="text-xs text-ink-muted">
                      {formatCurrency(menu.sellingPrice)}
                      {menu.requiresSelection ? " · choices" : ""}
                      {menu.maxPortions <= 0
                        ? " · 86'd"
                        : ` · ${menu.maxPortions} left`}
                    </div>
                  </button>
                ))}
                </div>
              )}
            </CardContent>
          </Card>

          <ComboPicker
            shopId={shopId}
            openComboId={openComboId}
            onOpenComboConsumed={() => setOpenComboId(null)}
            onAdd={(line) => {
              setComboCart((prev) => [
                ...prev,
                {
                  key: `${line.combo_id}-${Date.now()}`,
                  ...line,
                },
              ]);
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle>Cart</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {cart.length === 0 && comboCart.length === 0 ? (
                <p className="text-sm text-ink-muted">No items yet.</p>
              ) : (
                <>
                {comboCart.map((line) => (
                  <div
                    key={line.key}
                    className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        Combo: {line.name} × {line.quantity}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {line.combo_selections
                          .map((s) => s.menu_item_ids.join("+"))
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm tabular-nums">
                        {formatCurrency(line.selling_price * line.quantity)}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setComboCart((prev) =>
                            prev.filter((x) => x.key !== line.key),
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {cart.map((line) => (
                  <div
                    key={line.key}
                    className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {line.menu.name} × {line.quantity}
                      </p>
                      {line.selections.length > 0 ? (
                        <ul className="mt-1 text-xs text-ink-muted">
                          {line.selections.map((s) => (
                            <li
                              key={`${s.component_key}-${s.finished_good_id}`}
                            >
                              {s.component_key}:{" "}
                              {s.finished_good_name || s.finished_good_id} ×{" "}
                              {s.quantity}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-ink-faint">
                          Fixed components only
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm tabular-nums">
                        {formatCurrency(
                          line.menu.sellingPrice * line.quantity,
                        )}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setCart((prev) =>
                            prev.filter((c) => c.key !== line.key),
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                </>
              )}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm font-medium">Total</span>
                <span className="font-display text-base font-semibold">
                  {formatCurrency(total)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </Modal>

      <Modal
        open={!!activeMenu}
        onOpenChange={(next) => !next && setActiveMenu(null)}
        title={activeMenu ? `Add ${activeMenu.name}` : "Add item"}
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActiveMenu(null)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={addDraftToCart}>
              Add to cart
            </Button>
          </>
        }
      >
        {activeMenu ? (
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                Quantity
              </label>
              <Input
                type="number"
                min={1}
                value={String(draftQty)}
                onChange={(e) =>
                  setDraftQty(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>

            {dedupeMenuLines(activeMenu.lines).map((component) => {
              if (
                component.componentType === "FIXED" ||
                component.componentType === "INVENTORY"
              ) {
                return (
                  <div
                    key={component.componentKey}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">
                        {component.componentType === "INVENTORY"
                          ? "Inventory"
                          : "Fixed"}
                      </Badge>
                      <span className="font-medium">
                        {component.finishedGoodName ||
                          component.finishedGoodId}
                      </span>
                      <span className="text-ink-muted">
                        × {component.quantityRequired * draftQty}
                      </span>
                    </div>
                  </div>
                );
              }

              const need = requiredUnits(component, draftQty);
              const got = selectionTotal(
                draftSelections,
                component.componentKey,
              );

              return (
                <div
                  key={component.componentKey}
                  className="rounded-md border border-border px-3 py-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {component.finishedGoodCategoryName ||
                          component.componentKey}
                      </p>
                      <p className="text-xs text-ink-muted">
                        Need {need} · selected {got}
                      </p>
                    </div>
                    <Badge tone={got === need ? "success" : "warning"}>
                      {got}/{need}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    {component.options.length === 0 ? (
                      <p className="text-xs text-ink-muted">
                        No finished goods in this category yet.
                      </p>
                    ) : (
                      component.options.map((option) => {
                        const current =
                          draftSelections.find(
                            (s) =>
                              s.component_key === component.componentKey &&
                              s.finished_good_id === option.finishedGoodId,
                          )?.quantity ?? 0;
                        const selected = current > 0;
                        const outOfStock =
                          (option.availableStock ?? 0) <= 0;
                        return (
                          <button
                            type="button"
                            key={option.finishedGoodId}
                            disabled={outOfStock && !selected}
                            onClick={() =>
                              selectChoiceOption(
                                component,
                                option.finishedGoodId,
                                option.finishedGoodName || option.finishedGoodId,
                                option.availableStock ?? 0,
                              )
                            }
                            className={
                              "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition " +
                              (selected
                                ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                                : outOfStock
                                  ? "cursor-not-allowed border-border opacity-50"
                                  : "border-border hover:border-primary-300 hover:bg-surface-muted")
                            }
                          >
                            <div>
                              <p className="font-medium">
                                {option.finishedGoodName}
                              </p>
                              <p className="text-xs text-ink-muted">
                                {outOfStock
                                  ? "Out of stock"
                                  : `Stock ${option.availableStock}`}
                                {selected ? ` · qty ${current}` : ""}
                              </p>
                            </div>
                            <Badge tone={selected ? "success" : "neutral"}>
                              {selected ? "Selected" : "Select"}
                            </Badge>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </Modal>
    </>
  );
}