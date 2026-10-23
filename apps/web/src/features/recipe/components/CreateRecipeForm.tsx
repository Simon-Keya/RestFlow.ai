"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { ApiError } from "@/lib/api/errors";
import { createRecipeSchema } from "../schema";
import {
  RECIPE_UNITS,
  RECIPE_CATEGORIES,
  EMPTY_INGREDIENT,
} from "../constants";
import {
  RecipeIngredientsEditor,
  type IngredientDraft,
} from "./RecipeIngredientEditor";
import {
  RecipeOutputsEditor,
  type OutputDraft,
} from "./RecipeOutputsEditor";
import type { CreateRecipeInput } from "../schema";

export function CreateRecipeForm({
  isSubmitting,
  error,
  onSubmit,
}: {
  isSubmitting?: boolean;
  error?: Error | null;
  onSubmit: (input: CreateRecipeInput) => void;
}) {
  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [standardYield, setStandardYield] = useState("1");
  const [unit, setUnit] = useState("portion");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [multiOutput, setMultiOutput] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([
    { ...EMPTY_INGREDIENT },
  ]);
  const [outputs, setOutputs] = useState<OutputDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const busy = Boolean(isSubmitting);

  function handleSubmit() {
    if (busy) return;

    const cleanedIngredients = ingredients.filter(
      (row) =>
        row.rawItemId.trim() &&
        row.rawItemName.trim() &&
        row.quantityPerUnit.trim() !== "" &&
        Number(row.quantityPerUnit) > 0,
    );

    const cleanedOutputs = multiOutput
      ? outputs
          .filter(
            (row) =>
              row.itemId.trim() &&
              row.unitWeight.trim() !== "" &&
              Number(row.unitWeight) > 0,
          )
          .map((row, index) => ({
            itemId: row.itemId.trim(),
            itemName: row.itemName.trim() || row.itemId.trim(),
            standardQuantity:
              row.standardQuantity.trim() !== "" &&
              Number(row.standardQuantity) > 0
                ? row.standardQuantity
                : undefined,
            unit: row.unit || "pcs",
            unitWeight: row.unitWeight,
            weightUnit: row.weightUnit || "g",
            isDefault: row.isDefault || index === 0,
          }))
      : undefined;

    if (multiOutput && (!cleanedOutputs || cleanedOutputs.length < 2)) {
      setFormError(
        "Add at least two output sizes, each with a fixed weight per piece.",
      );
      return;
    }

    const parsed = createRecipeSchema.safeParse({
      itemId: itemId.trim(),
      itemName: itemName.trim(),
      standardYield,
      unit,
      category: category.trim() || undefined,
      notes: notes.trim() || undefined,
      recipeType: multiOutput ? "MULTI_OUTPUT" : "SINGLE_OUTPUT",
      yieldBasis: "BATCH",
      yieldQuantity: Number(standardYield) || undefined,
      yieldUnit: unit,
      ingredients: cleanedIngredients.map((row) => ({
        rawItemId: row.rawItemId.trim(),
        rawItemName: row.rawItemName.trim(),
        quantityPerUnit: row.quantityPerUnit,
        unit: row.unit,
        unitCost: row.unitCost === "" ? undefined : row.unitCost,
      })),
      outputs: cleanedOutputs,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }

    setFormError(null);
    onSubmit(parsed.data);
  }

  const displayError =
    formError ??
    (error instanceof ApiError
      ? error.message
      : error
        ? "Could not save recipe."
        : null);

  const targetYieldKg =
    unit === "kg" && Number(standardYield) > 0
      ? Number(standardYield)
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      {displayError ? <Alert tone="danger" title={displayError} /> : null}

      <div className="rounded-md border border-border bg-surface-muted/40 px-3 py-2 text-xs text-ink-muted">
        <p>
          <strong className="text-ink">Finished item ID / SKU</strong> — parent
          product (e.g. <code className="text-ink">DOUGH</code>). Size SKUs go
          under Outputs.
        </p>
        <p className="mt-1">
          <strong className="text-ink">Multi-output</strong> — set fixed weight
          per piece (100g / 150g / 250g). Production enters whole-number counts
          later; do not lock production quantities here.
        </p>
        <p className="mt-1">
          <strong className="text-ink">Category</strong> — type freely or pick a
          suggestion.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="multi-output"
          type="checkbox"
          checked={multiOutput}
          onChange={(e) => setMultiOutput(e.target.checked)}
          disabled={busy}
          className="h-4 w-4 rounded border-border"
        />
        <label htmlFor="multi-output" className="text-sm text-ink">
          Multi-output (L / M / S sizes with fixed weights)
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Finished item ID / SKU
          </label>
          <Input
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            placeholder="e.g. DOUGH or BURGER-FG"
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Finished item name
          </label>
          <Input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="e.g. Pizza dough"
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Standard / expected yield (batch)
          </label>
          <Input
            type="number"
            min="0.001"
            step="any"
            value={standardYield}
            onChange={(e) => setStandardYield(e.target.value)}
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Yield unit
          </label>
          <Select
            value={unit}
            onValueChange={setUnit}
            options={RECIPE_UNITS.map((u) => ({
              value: u.value,
              label: u.label,
            }))}
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Category (optional — type or pick)
          </label>
          <Input
            list="recipe-category-suggestions"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Dough, Hot kitchen…"
            disabled={busy}
          />
          <datalist id="recipe-category-suggestions">
            {RECIPE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Notes (optional)
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Prep notes"
            disabled={busy}
          />
        </div>
      </div>

      {multiOutput ? (
        <RecipeOutputsEditor
          rows={outputs}
          onChange={setOutputs}
          disabled={busy}
          targetYieldKg={targetYieldKg}
        />
      ) : (
        <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-ink-muted">
          <p className="font-medium text-ink">Default output</p>
          <p className="mt-0.5">
            {itemId.trim() || "—"} · {standardYield || "—"} {unit}
            {itemName.trim() ? ` (${itemName.trim()})` : ""}
          </p>
        </div>
      )}

      <RecipeIngredientsEditor rows={ingredients} onChange={setIngredients} />

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          onClick={handleSubmit}
          loading={busy}
          disabled={busy}
        >
          Save recipe
        </Button>
      </div>
    </div>
  );
}
