"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { menuApi } from "@/features/menu/api";
import { formatCurrency } from "@/lib/format/currency";

export type ComboSelectionPayload = {
  group_index: number;
  menu_item_ids: string[];
};

/**
 * Multi-qty combo builder (spec):
 *   Total required per group = group.quantity × comboQty
 * One screen with steppers — not N popups. Free split across items; CTA gated.
 */
export function ComboPicker({
  shopId,
  onAdd,
  /** When set (e.g. from POS search), open this combo and clear picks. Parent may reset to null after. */
  openComboId = null,
  onOpenComboConsumed,
}: {
  shopId: string;
  onAdd: (line: {
    combo_id: string;
    name: string;
    selling_price: number;
    quantity: number;
    combo_selections: ComboSelectionPayload[];
  }) => void;
  openComboId?: string | null;
  onOpenComboConsumed?: () => void;
}) {
  const combosQ = useQuery({
    queryKey: ["menu-combos", shopId],
    queryFn: () => menuApi.listCombos(shopId),
  });
  const catsQ = useQuery({
    queryKey: ["menu-categories", shopId],
    queryFn: () => menuApi.listCategories(shopId),
  });
  const menuQ = useQuery({
    queryKey: ["menu", "list", shopId],
    queryFn: () => menuApi.list(shopId),
  });

  const combos = combosQ.data ?? [];

  const [activeComboId, setActiveComboId] = useState<string | null>(null);
  const [comboQty, setComboQty] = useState(1);
  /** groupIndex → itemId → count */
  const [picks, setPicks] = useState<Record<number, Record<string, number>>>(
    {},
  );

  // Auto-open when POS search (or parent) requests a combo
  useEffect(() => {
    if (!openComboId) return;
    const exists = combos.some((c) => c.comboId === openComboId);
    if (exists) {
      setActiveComboId(openComboId);
      setComboQty(1);
      setPicks({});
    }
    onOpenComboConsumed?.();
    // Intentionally only react to openComboId (and combos once loaded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openComboId, combos]);

  const active = combos.find((c) => c.comboId === activeComboId) ?? null;

  const categoryItems = useMemo(() => {
    const cats = catsQ.data ?? [];
    const menus = menuQ.data ?? [];
    const nameById = new Map<string, string>();
    for (const m of menus) {
      nameById.set(m.menuId, m.name);
      if (m.menuCode) nameById.set(m.menuCode, m.name);
    }

    const map = new Map<string, { id: string; name: string }[]>();
    for (const c of cats) {
      const fromApi = (
        (c as { menuItems?: Array<{ menuItemId: string; name: string }> })
          .menuItems ?? []
      ).filter((m) => m.menuItemId);
      const ids =
        fromApi.length > 0
          ? fromApi.map((m) => m.menuItemId)
          : (c.menuItemIds ?? []);

      map.set(
        c.categoryId,
        ids.map((id) => {
          const named = fromApi.find((m) => m.menuItemId === id);
          return {
            id,
            name: named?.name || nameById.get(id) || id,
          };
        }),
      );
    }
    return map;
  }, [catsQ.data, menuQ.data]);

  function requiredForGroup(perCombo: number): number {
    return Math.max(0, perCombo) * Math.max(1, comboQty);
  }

  function selectedInGroup(groupIndex: number): number {
    const bag = picks[groupIndex] ?? {};
    return Object.values(bag).reduce((s, n) => s + (Number(n) || 0), 0);
  }

  function setItemCount(groupIndex: number, itemId: string, next: number) {
    setPicks((prev) => {
      const bag = { ...(prev[groupIndex] ?? {}) };
      const group = active?.selectionGroups.find(
        (g) => g.groupIndex === groupIndex,
      );
      const max = group ? requiredForGroup(group.quantity) : 0;
      const others = Object.entries(bag)
        .filter(([id]) => id !== itemId)
        .reduce((s, [, n]) => s + (Number(n) || 0), 0);
      const allowed = Math.max(0, max - others);
      const clamped = Math.max(0, Math.min(Math.floor(next), allowed));
      if (clamped <= 0) {
        delete bag[itemId];
      } else {
        bag[itemId] = clamped;
      }
      return { ...prev, [groupIndex]: bag };
    });
  }

  function missingLabel(): string | null {
    if (!active) return null;
    const parts: string[] = [];
    for (const g of active.selectionGroups) {
      const need = requiredForGroup(g.quantity);
      const got = selectedInGroup(g.groupIndex);
      if (got < need) {
        parts.push(
          `${need - got} more from ${g.menuCategoryName || g.menuCategoryId}`,
        );
      }
    }
    return parts.length ? parts.join(" · ") : null;
  }

  function canSubmit(): boolean {
    if (!active) return false;
    return active.selectionGroups.every((g) => {
      const need = requiredForGroup(g.quantity);
      return selectedInGroup(g.groupIndex) === need;
    });
  }

  /** Expand counts into repeated menu_item_ids for API (N picks = N ids). */
  function toApiSelections(): ComboSelectionPayload[] {
    if (!active) return [];
    return active.selectionGroups.map((g) => {
      const bag = picks[g.groupIndex] ?? {};
      const ids: string[] = [];
      for (const [id, count] of Object.entries(bag)) {
        for (let i = 0; i < (Number(count) || 0); i++) ids.push(id);
      }
      return { group_index: g.groupIndex, menu_item_ids: ids };
    });
  }

  function resetActive(comboId: string | null) {
    setActiveComboId(comboId);
    setComboQty(1);
    setPicks({});
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Combos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {combos.map((c) => (
            <Button
              key={c.comboId}
              size="sm"
              variant={activeComboId === c.comboId ? "primary" : "secondary"}
              onClick={() => resetActive(c.comboId)}
            >
              {c.name} · {formatCurrency(c.sellingPrice)}
            </Button>
          ))}
          {combos.length === 0 ? (
            <p className="text-sm text-ink-muted">No combos configured.</p>
          ) : null}
        </div>

        {active ? (
          <div className="flex flex-col gap-4 border-t border-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-ink">{active.name}</p>
                <p className="text-xs text-ink-muted">
                  {formatCurrency(active.sellingPrice)} each · line{" "}
                  {formatCurrency(active.sellingPrice * comboQty)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">Combo qty</span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={comboQty <= 1}
                  onClick={() => {
                    setComboQty((q) => Math.max(1, q - 1));
                    setPicks({});
                  }}
                >
                  −
                </Button>
                <span className="min-w-[2rem] text-center font-semibold tabular-nums">
                  {comboQty}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setComboQty((q) => q + 1);
                    setPicks({});
                  }}
                >
                  +
                </Button>
              </div>
            </div>

            <p className="rounded-md bg-surface-muted px-3 py-2 text-xs text-ink-muted">
              Required = per-combo selection × combo qty. Split freely across
              items; totals must match.
            </p>

            {active.selectionGroups.map((g) => {
              const options = categoryItems.get(g.menuCategoryId) ?? [];
              const need = requiredForGroup(g.quantity);
              const got = selectedInGroup(g.groupIndex);
              const done = got === need;
              return (
                <div
                  key={g.groupIndex}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {g.menuCategoryName || g.menuCategoryId}
                      <span className="ml-2 text-xs font-normal text-ink-muted">
                        {g.quantity} × {comboQty} = {need} required
                      </span>
                    </p>
                    <Badge tone={done ? "success" : "warning"}>
                      {got} / {need}
                      {done ? " ✓" : ""}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    {options.map((o) => {
                      const count = picks[g.groupIndex]?.[o.id] ?? 0;
                      return (
                        <div
                          key={o.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="text-ink">{o.name}</span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={count <= 0}
                              onClick={() =>
                                setItemCount(g.groupIndex, o.id, count - 1)
                              }
                            >
                              −
                            </Button>
                            <span className="min-w-[1.5rem] text-center tabular-nums">
                              {count}
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={got >= need}
                              onClick={() =>
                                setItemCount(g.groupIndex, o.id, count + 1)
                              }
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {options.length === 0 ? (
                      <p className="text-xs text-danger">
                        No products in this category. Assign menu items under
                        Catalog → Categories.
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {!canSubmit() && missingLabel() ? (
              <p className="text-xs text-ink-muted">Still need: {missingLabel()}</p>
            ) : null}

            <Button
              disabled={!canSubmit()}
              onClick={() => {
                if (!active || !canSubmit()) return;
                onAdd({
                  combo_id: active.comboId,
                  name: active.name,
                  selling_price: active.sellingPrice,
                  quantity: comboQty,
                  combo_selections: toApiSelections(),
                });
                resetActive(null);
              }}
            >
              Add combo to order
              {comboQty > 1 ? ` (×${comboQty})` : ""}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
