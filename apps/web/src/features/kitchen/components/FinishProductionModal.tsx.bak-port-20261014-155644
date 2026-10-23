"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { ApiError } from "@/lib/api/errors";
import { formatQuantity } from "@/lib/format/numbers";
import { kitchenApi } from "../api";
import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { buildQueryString } from "@/lib/utils";
import type { ProductionQueueItem } from "../types";
import type { FinishProductionInput } from "../schema";

type LineDraft = {
  itemId: string;
  itemName: string;
  standardQuantity: number;
  actualQuantity: string;
  unit: string;
  unitCost: number;
  unitWeight: number | null;
  weightUnit: string | null;
};

/** Self-contained recipe shape — avoids kitchen Recipe type gaps */
type RecipeForFinish = {
  recipeId?: string;
  itemId?: string;
  menuItemId?: string;
  name?: string;
  standardYield?: number;
  unit?: string;
  yieldQuantity?: number;
  yieldUnit?: string;
  ingredients?: Array<{
    rawItemId: string;
    name?: string;
    rawItemName?: string;
    quantityPerUnit: number;
    unit: string;
    unitCost?: number | null;
  }>;
  outputs?: Array<{
    itemId: string;
    itemName?: string;
    standardQuantity?: number | null;
    unit?: string;
    unitWeight?: number | null;
    weightUnit?: string | null;
    isDefault?: boolean;
  }>;
};

function weightToKg(
  qty: number,
  unitWeight: number,
  weightUnit: string,
): number {
  const w = qty * unitWeight;
  const u = (weightUnit || "g").toLowerCase();
  if (u === "g") return w / 1000;
  if (u === "kg") return w;
  if (u === "ml") return w / 1000;
  if (u === "l") return w;
  return w;
}


/** Aggregate actual yield in recipe units (Michael: multi-output = same as single). */
function computeActualYieldFromOutputs(
  outputs: LineDraft[],
  yieldUnit: string,
  plannedFallback: number,
): number {
  const u = (yieldUnit || "pcs").toLowerCase();
  let massKg = 0;
  let anyWeight = false;
  let pieceSum = 0;
  for (const row of outputs) {
    const q = Number(row.actualQuantity);
    if (!Number.isFinite(q) || q < 0) continue;
    pieceSum += q;
    if (row.unitWeight != null && row.unitWeight > 0 && q > 0) {
      anyWeight = true;
      const wu = (row.weightUnit || "g").toLowerCase();
      const line =
        wu === "kg" || wu === "l"
          ? q * row.unitWeight
          : (q * row.unitWeight) / 1000; // g/ml → kg
      massKg += line;
    }
  }
  if (anyWeight && massKg > 0) {
    if (u === "g" || u === "ml") return massKg * 1000;
    if (u === "kg" || u === "l") return massKg;
    // Recipe yield unit unknown but weights exist — prefer kg
    return massKg;
  }
  if (pieceSum > 0) return pieceSum;
  return plannedFallback > 0 ? plannedFallback : 0;
}

function scaleFactor(planned: number, standardYield: number): number {
  const y = standardYield > 0 ? standardYield : 1;
  return planned > 0 ? planned / y : 1;
}

function buildDefaults(
  recipe: RecipeForFinish | null,
  queueItem: ProductionQueueItem,
): {
  inputs: LineDraft[];
  outputs: LineDraft[];
  actualYield: string;
  multiOutput: boolean;
  expectedYieldKg: number | null;
} {
  const planned = queueItem.batchSize || 1;
  const yieldQty =
    recipe?.yieldQuantity && recipe.yieldQuantity > 0
      ? recipe.yieldQuantity
      : recipe?.standardYield && recipe.standardYield > 0
        ? recipe.standardYield
        : 1;
  const yieldUnit = (recipe?.yieldUnit || recipe?.unit || "pcs").toLowerCase();
  const scale = scaleFactor(planned, yieldQty);

  const inputs: LineDraft[] = (recipe?.ingredients ?? []).map((ing) => {
    const std = Number(ing.quantityPerUnit || 0) * scale;
    return {
      itemId: ing.rawItemId,
      itemName: ing.name || ing.rawItemName || ing.rawItemId,
      standardQuantity: std,
      actualQuantity: String(std),
      unit: ing.unit || "pcs",
      unitCost: Number(ing.unitCost || 0),
      unitWeight: null,
      weightUnit: null,
    };
  });

  const recipeOutputs = recipe?.outputs ?? [];
  let outputs: LineDraft[];
  let multiOutput = false;

  if (recipeOutputs.length > 1) {
    multiOutput = true;
    outputs = recipeOutputs.map((o) => ({
      itemId: o.itemId,
      itemName: o.itemName || o.itemId,
      standardQuantity: 0,
      actualQuantity: "",
      unit: o.unit || "pcs",
      unitCost: 0,
      unitWeight:
        o.unitWeight != null && o.unitWeight > 0 ? o.unitWeight : null,
      weightUnit: o.weightUnit ?? "g",
    }));
  } else if (recipeOutputs.length === 1) {
    const o = recipeOutputs[0]!;
    const base =
      o.standardQuantity != null && o.standardQuantity > 0
        ? o.standardQuantity
        : planned;
    outputs = [
      {
        itemId: o.itemId,
        itemName: o.itemName || o.itemId,
        standardQuantity: base * scale,
        actualQuantity: String(base * scale),
        unit: o.unit || recipe?.yieldUnit || recipe?.unit || "pcs",
        unitCost: 0,
        unitWeight:
          o.unitWeight != null && o.unitWeight > 0 ? o.unitWeight : null,
        weightUnit: o.weightUnit ?? "g",
      },
    ];
  } else {
    outputs = [
      {
        itemId: recipe?.menuItemId || recipe?.itemId || "",
        itemName: queueItem.recipeName || recipe?.name || "",
        standardQuantity: planned,
        actualQuantity: String(planned),
        unit: recipe?.yieldUnit || recipe?.unit || "pcs",
        unitCost: 0,
        unitWeight: null,
        weightUnit: null,
      },
    ];
  }

  const expectedYieldKg =
    multiOutput && (yieldUnit === "kg" || yieldUnit === "g")
      ? yieldUnit === "g"
        ? (yieldQty * scale) / 1000
        : yieldQty * scale
      : multiOutput
        ? yieldQty * scale
        : null;

  const yieldFromOutputs = computeActualYieldFromOutputs(
    outputs,
    yieldUnit,
    planned,
  );

  return {
    inputs,
    outputs,
    actualYield: String(yieldFromOutputs > 0 ? yieldFromOutputs : planned),
    multiOutput,
    expectedYieldKg,
  };
}

export function FinishProductionModal({
  open,
  item,
  onOpenChange,
  onFinished,
}: {
  open: boolean;
  item: ProductionQueueItem | null;
  shopId?: string;
  onOpenChange: (open: boolean) => void;
  onFinished?: () => void;
}) {
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [inputs, setInputs] = useState<LineDraft[]>([]);
  const [outputs, setOutputs] = useState<LineDraft[]>([]);
  const [actualYield, setActualYield] = useState("1");
  const [wasteQuantity, setWasteQuantity] = useState("0");
  const [wasteReason, setWasteReason] = useState("");
  const [unitCost, setUnitCost] = useState("0");
  const [multiOutput, setMultiOutput] = useState(false);
  const [expectedYieldKg, setExpectedYieldKg] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !item) return;

    const queueItem = item;
    let cancelled = false;

    async function load() {
      setLoadingRecipe(true);
      setError(null);
      setBatchNumber("");
      // Default expiry empty — user must choose (shelf-life of produced FG)
      setExpiryDate("");

      try {
        const recipe = queueItem.recipeId
          ? ((await kitchenApi.getRecipe(
              queueItem.recipeId,
            )) as RecipeForFinish)
          : null;
        if (cancelled) return;
        const defaults = buildDefaults(recipe, queueItem);
        setInputs(defaults.inputs);
        setOutputs(defaults.outputs);
        setActualYield(defaults.actualYield);
        setMultiOutput(defaults.multiOutput);
        setExpectedYieldKg(defaults.expectedYieldKg);
        setWasteQuantity("0");
        setWasteReason("");
        setUnitCost("0");
      } catch (err) {
        if (cancelled) return;
        const fallback = buildDefaults(null, queueItem);
        setInputs(fallback.inputs);
        setOutputs(fallback.outputs);
        setActualYield(fallback.actualYield);
        setMultiOutput(false);
        setExpectedYieldKg(null);
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load recipe standards; enter actuals manually.",
        );
      } finally {
        if (!cancelled) setLoadingRecipe(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, item]);

  const title = useMemo(() => {
    if (!item) return "Finish production";
    return `Finish: ${item.recipeName}`;
  }, [item]);

  const actualYieldKg = useMemo(() => {
    return outputs.reduce((sum, row) => {
      const q = Number(row.actualQuantity);
      if (!Number.isFinite(q) || q <= 0 || row.unitWeight == null) return sum;
      return sum + weightToKg(q, row.unitWeight, row.weightUnit || "g");
    }, 0);
  }, [outputs]);

  const yieldVarianceKg =
    expectedYieldKg != null && actualYieldKg > 0
      ? expectedYieldKg - actualYieldKg
      : null;

  // Live WAC for input lines (Michael FEFO/WAC — no hand-typed cost)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = [...inputs];
      let changed = false;
      for (let i = 0; i < next.length; i++) {
        const row = next[i];
        if (!row?.itemId) continue;
        try {
          const { data } = await apiClient.get(
            `${endpoints.costing.sku(row.itemId)}${buildQueryString({
              shopId: "1",
            })}`,
          );
          const root = (data ?? {}) as Record<string, unknown>;
          const wac = Number(root.avgUnitCost ?? root.avg_unit_cost ?? 0);
          if (wac > 0 && row.unitCost !== wac) {
            next[i] = { ...row, unitCost: wac };
            changed = true;
          }
        } catch {
          /* keep existing */
        }
      }
      if (!cancelled && changed) setInputs(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.map((r) => r.itemId).join("|")]);

  const batchCostFromWac = useMemo(() => {
    return inputs.reduce((sum, row) => {
      const q = Number(row.actualQuantity);
      const c = Number(row.unitCost);
      if (!Number.isFinite(q) || !Number.isFinite(c)) return sum;
      return sum + q * c;
    }, 0);
  }, [inputs]);


  if (!open || !item) return null;

  const activeItem = item;

  function updateInput(index: number, value: string) {
    setInputs((rows) =>
      rows.map((row, i) =>
        i === index ? { ...row, actualQuantity: value } : row,
      ),
    );
  }

  function updateOutput(index: number, value: string) {
    setOutputs((rows) => {
      const next = rows.map((row, i) =>
        i === index ? { ...row, actualQuantity: value } : row,
      );
      const yUnit = (item?.recipeId && outputs[0]?.unit) || "pcs";
      // Prefer recipe yield unit when available via first output / planned semantics
      const yieldUnit =
        next.find((r) => r.unit)?.unit ||
        yUnit ||
        "pcs";
      const y = computeActualYieldFromOutputs(next, yieldUnit, 0);
      setActualYield(String(y > 0 ? y : 0));
      return next;
    });
  }

  
  async function handleSubmit() {
    if (submitting) return;
    setError(null);

    if (!batchNumber.trim()) {
      setError("Batch number is required.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate.trim())) {
      setError("Expiry date is required for the produced item.");
      return;
    }
    {
      const exp = new Date(expiryDate.trim() + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(exp.getTime()) || exp < today) {
        setError("Expiry date must be today or a future date.");
        return;
      }
    }

    if (multiOutput) {
      for (const row of outputs) {
        if (!row.itemId.trim()) {
          setError("Each output needs a finished SKU.");
          return;
        }
        const q = Number(row.actualQuantity);
        if (row.actualQuantity.trim() === "" || !Number.isFinite(q) || q < 0) {
          setError(`Enter actual count for ${row.itemName || row.itemId}.`);
          return;
        }
        if (!Number.isInteger(q)) {
          setError(
            `Counts must be whole numbers (${row.itemName || row.itemId}).`,
          );
          return;
        }
      }
    }

    const yieldUnitHint =
      outputs.find((r) => r.weightUnit)?.weightUnit ||
      outputs.find((r) => r.unit)?.unit ||
      "g";
    // Unified yield (mass when unit_weight present) — not piece sum alone
    const fromOutputs = computeActualYieldFromOutputs(
      outputs,
      yieldUnitHint,
      0,
    );
    const yieldNum = Number(actualYield);
    const primaryYield =
      fromOutputs > 0
        ? fromOutputs
        : Number.isFinite(yieldNum) && yieldNum > 0
          ? yieldNum
          : 0;

    if (!Number.isFinite(primaryYield) || primaryYield <= 0) {
      setError("Enter positive actual quantities.");
      return;
    }

    const payload: FinishProductionInput = {
      productionId: activeItem.productionId,
      actualYield: primaryYield,
      wasteQuantity: Number(wasteQuantity) || 0,
      wasteReason: wasteReason || undefined,
      unitCost: Number(unitCost) || 0,
      inputs: inputs.map((row) => ({
        itemId: row.itemId,
        itemName: row.itemName,
        standardQuantity: row.standardQuantity,
        actualQuantity: Number(row.actualQuantity),
        unit: row.unit,
        unitCost: row.unitCost,
      })),
      outputs: outputs.map((row) => ({
        itemId: row.itemId,
        itemName: row.itemName,
        standardQuantity: row.standardQuantity,
        actualQuantity: Number(row.actualQuantity) || 0,
        unit: row.unit,
        unitCost: row.unitCost || Number(unitCost) || 0,
        unitWeight: row.unitWeight ?? undefined,
        weightUnit: row.weightUnit ?? undefined,
      })),
    };

    setSubmitting(true);
    try {
      await kitchenApi.finishProduction(
        activeItem.productionId,
        payload.actualYield,
        {
          plannedQuantity: activeItem.batchSize,
          unitCost: payload.unitCost,
          wasteQuantity: payload.wasteQuantity,
          wasteReason: payload.wasteReason,
          inputs: payload.inputs,
          outputs: payload.outputs,
          batchNumber: batchNumber.trim(),
          expiryDate: expiryDate.trim(),
        },
      );
      onOpenChange(false);
      onFinished?.();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not finish production.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Planned batch {activeItem.batchSize}.
            {multiOutput
              ? " Enter whole-number counts per size. Yield weight is calculated from recipe weights — variance is recorded, quantities are not auto-fixed."
              : " Edit actuals where they differ from standard."}
          </p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {error ? <Alert tone="danger" title={error} /> : null}

          {loadingRecipe ? (
            <p className="text-sm text-ink-muted">Loading recipe standards…</p>
          ) : (
            <>
              {multiOutput ? (
                <div className="rounded-md border border-border bg-surface-muted/40 px-3 py-2 text-sm">
                  <p className="font-medium text-ink">
                    Actual yield ≈ {actualYieldKg.toFixed(3)} kg
                  </p>
                  {expectedYieldKg != null ? (
                    <p className="mt-0.5 text-ink-muted">
                      Expected ≈ {expectedYieldKg.toFixed(3)} kg
                      {yieldVarianceKg != null
                        ? ` · Variance ${
                            yieldVarianceKg >= 0 ? "" : "+"
                          }${(-yieldVarianceKg).toFixed(3)} kg${
                            yieldVarianceKg > 0
                              ? " loss"
                              : yieldVarianceKg < 0
                                ? " over"
                                : ""
                          }`
                        : null}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {!multiOutput ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-muted">
                      Actual yield
                    </label>
                    <Input
                      type="number"
                      min="0.001"
                      step="any"
                      value={actualYield}
                      onChange={(e) => setActualYield(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-muted">
                      Total pieces
                    </label>
                    <Input value={actualYield} disabled readOnly />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Unit cost (optional)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={batchCostFromWac > 0 ? String(Math.round(batchCostFromWac * 100) / 100) : unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Waste qty
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={wasteQuantity}
                    onChange={(e) => setWasteQuantity(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Waste reason
                  </label>
                  <Input
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    placeholder="Optional"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-ink">
                  Inputs (ingredients)
                </p>
                {inputs.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    No ingredient standards on this recipe.
                  </p>
                ) : (
                  <Table>
                    <TableHead>
                      <tr>
                        <TableHeaderCell>Item</TableHeaderCell>
                        <TableHeaderCell className="text-right">
                          Standard
                        </TableHeaderCell>
                        <TableHeaderCell className="text-right">
                          Actual
                        </TableHeaderCell>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {inputs.map((row, index) => (
                        <TableRow key={`${row.itemId}-${index}`}>
                          <TableCell>
                            <div className="font-medium">{row.itemName}</div>
                            <div className="text-xs text-ink-faint">
                              {row.itemId}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-ink-muted">
                            {formatQuantity(row.standardQuantity, row.unit)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              className="ml-auto max-w-[8rem] text-right"
                              type="number"
                              step="any"
                              value={row.actualQuantity}
                              onChange={(e) =>
                                updateInput(index, e.target.value)
                              }
                              disabled={submitting}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-ink">
                  Outputs{multiOutput ? " (sizes — whole numbers)" : ""}
                </p>
                <Table>
                  <TableHead>
                    <tr>
                      <TableHeaderCell>Item</TableHeaderCell>
                      {multiOutput ? (
                        <TableHeaderCell className="text-right">
                          Weight
                        </TableHeaderCell>
                      ) : (
                        <TableHeaderCell className="text-right">
                          Standard
                        </TableHeaderCell>
                      )}
                      <TableHeaderCell className="text-right">
                        Actual
                      </TableHeaderCell>
                      {multiOutput ? (
                        <TableHeaderCell className="text-right">
                          Subtotal
                        </TableHeaderCell>
                      ) : null}
                    </tr>
                  </TableHead>
                  <TableBody>
                    {outputs.map((row, index) => {
                      const q = Number(row.actualQuantity);
                      const subKg =
                        multiOutput &&
                        row.unitWeight != null &&
                        Number.isFinite(q) &&
                        q > 0
                          ? weightToKg(q, row.unitWeight, row.weightUnit || "g")
                          : null;
                      return (
                        <TableRow key={`${row.itemId}-${index}`}>
                          <TableCell>
                            <div className="font-medium">
                              {row.itemName || "Finished good"}
                            </div>
                            <div className="text-xs text-ink-faint">
                              {row.itemId || "—"}
                            </div>
                          </TableCell>
                          {multiOutput ? (
                            <TableCell className="text-right tabular-nums text-ink-muted">
                              {row.unitWeight != null
                                ? `${row.unitWeight} ${row.weightUnit || "g"}`
                                : "—"}
                            </TableCell>
                          ) : (
                            <TableCell className="text-right tabular-nums text-ink-muted">
                              {formatQuantity(row.standardQuantity, row.unit)}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <Input
                              className="ml-auto max-w-[8rem] text-right"
                              type="number"
                              min={0}
                              step={multiOutput ? 1 : "any"}
                              value={row.actualQuantity}
                              onChange={(e) =>
                                updateOutput(index, e.target.value)
                              }
                              disabled={submitting}
                            />
                          </TableCell>
                          {multiOutput ? (
                            <TableCell className="text-right tabular-nums text-ink-muted">
                              {subKg != null ? `${subKg.toFixed(3)} kg` : "—"}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">
                Batch number <span className="text-danger">*</span>
              </label>
              <Input
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="e.g. PROD-DOUGH-0410"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">
                Expiry date <span className="text-danger">*</span>
              </label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
                min={new Date().toISOString().slice(0, 10)}
              />
              <p className="mt-1 text-xs text-ink-muted">
                When this produced stock expires (required before finish).
              </p>
            </div>
          </div>

        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            loading={submitting}
            disabled={loadingRecipe || submitting}
          >
            Complete batch
          </Button>
        </div>
      </div>
    </div>
  );
}
