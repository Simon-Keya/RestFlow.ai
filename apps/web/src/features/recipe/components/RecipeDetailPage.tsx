"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FullPageSpinner } from "@/components/feedback/FullPageSpinner";
import { RoleGate } from "@/components/layout/RoleGate";
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from "@/components/ui/Table";
import { routes } from "@/lib/routes";
import { formatQuantity } from "@/lib/format/numbers";
import { formatCurrency } from "@/lib/format/currency";
import { useToast } from "@/providers/ToastProvider";
import { ApiError } from "@/lib/api/errors";
import { RECIPE_UNITS, RECIPE_CATEGORIES, EMPTY_INGREDIENT } from "../constants";
import { updateRecipeSchema } from "../schema";
import { useRecipe } from "../hooks/use-recipe";
import { useUpdateRecipe } from "../hooks/use-update-recipe";
import { RecipeIngredientsEditor, type IngredientDraft } from "./RecipeIngredientEditor";
import { RecipeOutputsEditor, type OutputDraft } from "./RecipeOutputsEditor";

export function RecipeDetailPage({ shopId, recipeId }: { shopId: string; recipeId: string }) {
  const recipe = useRecipe(recipeId);
  const update = useUpdateRecipe(shopId, recipeId);
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [standardYield, setStandardYield] = useState("");
  const [unit, setUnit] = useState("portion");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [multiOutput, setMultiOutput] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const [outputs, setOutputs] = useState<OutputDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  if (recipe.isPending) return <FullPageSpinner label="Loading recipe…" />;
  if (recipe.isError) {
    return <ErrorState title="Couldn't load this recipe" description={recipe.error.message} onRetry={recipe.refetch} />;
  }

  const data = recipe.data;
  const viewIngredients = data.ingredients ?? [];
  const viewOutputs = data.outputs ?? [];

  function startEdit() {
    setItemId(data.itemId ?? "");
    setItemName(data.name ?? "");
    setStandardYield(String(data.standardYield ?? 1));
    setUnit(data.unit || "portion");
    setCategory(data.category ?? "");
    setNotes(data.notes ?? "");
    setMultiOutput(data.recipeType === "MULTI_OUTPUT");
    setIngredients(
      (data.ingredients ?? []).length > 0
        ? (data.ingredients ?? []).map((ing) => ({
            rawItemId: ing.rawItemId ?? "",
            rawItemName: ing.rawItemName ?? "",
            quantityPerUnit: String(ing.quantityPerUnit ?? ""),
            unit: ing.unit || "g",
            unitCost: ing.unitCost != null && ing.unitCost > 0 ? String(ing.unitCost) : "",
          }))
        : [{ ...EMPTY_INGREDIENT }],
    );
    setOutputs(
      (data.outputs ?? []).map((o, index) => ({
        itemId: o.itemId ?? "",
        itemName: o.itemName ?? "",
        standardQuantity: o.standardQuantity != null ? String(o.standardQuantity) : "",
        unit: o.unit || "pcs",
        unitWeight: o.unitWeight != null ? String(o.unitWeight) : "",
        weightUnit: o.weightUnit || "g",
        isDefault: o.isDefault ?? index === 0,
      })),
    );
    setFormError(null);
    setEditing(true);
  }

  function handleSave() {
    if (update.isPending) return;
    const cleanedIngredients = ingredients.filter(
      (row) => row.rawItemId.trim() && row.rawItemName.trim() && Number(row.quantityPerUnit) > 0,
    );
    const cleanedOutputs = multiOutput
      ? outputs
          .filter((row) => row.itemId.trim() && Number(row.unitWeight) > 0)
          .map((row, index) => ({
            itemId: row.itemId.trim(),
            itemName: row.itemName.trim() || row.itemId.trim(),
            standardQuantity: row.standardQuantity.trim() !== "" ? Number(row.standardQuantity) : undefined,
            unit: row.unit || "pcs",
            unitWeight: Number(row.unitWeight),
            weightUnit: row.weightUnit || "g",
            isDefault: row.isDefault || index === 0,
          }))
      : undefined;
    if (multiOutput && (!cleanedOutputs || cleanedOutputs.length < 2)) {
      setFormError("Add at least two output sizes, each with a fixed weight per piece.");
      return;
    }
    if (cleanedIngredients.length < 1) {
      setFormError("Add at least one ingredient.");
      return;
    }
    const parsed = updateRecipeSchema.safeParse({
      itemId: itemId.trim(),
      itemName: itemName.trim(),
      standardYield: Number(standardYield),
      unit,
      category: category.trim() || null,
      notes: notes.trim() || null,
      recipeType: multiOutput ? "MULTI_OUTPUT" : "SINGLE_OUTPUT",
      yieldBasis: "BATCH",
      yieldQuantity: Number(standardYield) || undefined,
      yieldUnit: unit,
      ingredients: cleanedIngredients.map((row) => ({
        rawItemId: row.rawItemId.trim(),
        rawItemName: row.rawItemName.trim(),
        quantityPerUnit: Number(row.quantityPerUnit),
        unit: row.unit,
        unitCost: row.unitCost.trim() !== "" ? Number(row.unitCost) : undefined,
      })),
      outputs: cleanedOutputs,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }
    setFormError(null);
    update.mutate(parsed.data, {
      onSuccess: () => {
        toast({ title: "Recipe updated", variant: "success" });
        setEditing(false);
        void recipe.refetch();
      },
      onError: (err) => {
        setFormError(err instanceof ApiError ? err.message : "Could not update recipe.");
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href={routes.recipes(shopId)} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to recipes
      </Link>
      <PageHeader
        title={data.name}
        description={`Finished SKU ${data.itemId} · yield ${data.standardYield} ${data.unit}`}
        actions={
          <RoleGate allow={["ADMIN"]}>
            {editing ? (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={update.isPending}>Cancel</Button>
                <Button size="sm" onClick={handleSave} loading={update.isPending} disabled={update.isPending}>Save changes</Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={startEdit}>Edit recipe</Button>
            )}
          </RoleGate>
        }
      />
      {formError ? <Alert tone="danger" title="Could not save" description={formError} /> : null}
      {editing ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-4">
          <p className="text-sm text-ink-muted">Same fields as Create — including SKU, ingredients, and outputs.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">Finished item ID / SKU *</label>
              <Input value={itemId} onChange={(e) => setItemId(e.target.value)} disabled={update.isPending} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">Finished item name *</label>
              <Input value={itemName} onChange={(e) => setItemName(e.target.value)} disabled={update.isPending} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">Standard yield *</label>
              <Input type="number" min="0.001" step="any" value={standardYield} onChange={(e) => setStandardYield(e.target.value)} disabled={update.isPending} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">Yield unit</label>
              <Select value={unit} onValueChange={setUnit} options={RECIPE_UNITS.map((u) => ({ value: u.value, label: u.label }))} disabled={update.isPending} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">Category (optional)</label>
              <Input list="recipe-edit-category-suggestions" value={category} onChange={(e) => setCategory(e.target.value)} disabled={update.isPending} />
              <datalist id="recipe-edit-category-suggestions">{RECIPE_CATEGORIES.map((c) => <option key={c.value} value={c.value} />)}</datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">Notes (optional)</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={update.isPending} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={multiOutput} onChange={(e) => setMultiOutput(e.target.checked)} disabled={update.isPending} />
            Multi-output recipe
          </label>
          {multiOutput ? (
            <RecipeOutputsEditor rows={outputs} onChange={setOutputs} disabled={update.isPending} />
          ) : (
            <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-ink-muted">
              Default output: {itemId || "—"} · {standardYield || "—"} {unit}
            </div>
          )}
          <RecipeIngredientsEditor rows={ingredients} onChange={setIngredients} />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4"><p className="text-xs uppercase text-ink-faint">SKU</p><p className="mt-1 font-medium tabular-nums">{data.itemId}</p></Card>
            <Card className="p-4"><p className="text-xs uppercase text-ink-faint">Yield</p><p className="mt-1 font-medium">{data.standardYield} {data.unit}</p></Card>
            <Card className="p-4"><p className="text-xs uppercase text-ink-faint">Category</p><p className="mt-1 font-medium">{data.category || "—"}</p></Card>
            <Card className="p-4"><p className="text-xs uppercase text-ink-faint">Type</p><p className="mt-1 font-medium">{(data.recipeType ?? "SINGLE_OUTPUT").replace(/_/g, " ")}</p></Card>
          </div>
          {viewOutputs.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Outputs</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHead><tr><TableHeaderCell>Item ID</TableHeaderCell><TableHeaderCell>Name</TableHeaderCell><TableHeaderCell>Unit</TableHeaderCell><TableHeaderCell className="text-right">Weight</TableHeaderCell></tr></TableHead>
                  <TableBody>
                    {viewOutputs.map((o, i) => (
                      <TableRow key={`${o.itemId}-${i}`}>
                        <TableCell className="font-medium">{o.itemId}</TableCell>
                        <TableCell>{o.itemName || "—"}</TableCell>
                        <TableCell>{o.unit}</TableCell>
                        <TableCell className="text-right tabular-nums">{o.unitWeight != null ? `${o.unitWeight} ${o.weightUnit || "g"}` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader><CardTitle>Ingredients</CardTitle></CardHeader>
            <CardContent className="p-0">
              {viewIngredients.length === 0 ? (
                <p className="p-4 text-sm text-ink-muted">No ingredients.</p>
              ) : (
                <Table>
                  <TableHead><tr><TableHeaderCell>SKU</TableHeaderCell><TableHeaderCell>Name</TableHeaderCell><TableHeaderCell className="text-right">Qty</TableHeaderCell><TableHeaderCell>Unit</TableHeaderCell><TableHeaderCell className="text-right">Cost</TableHeaderCell></tr></TableHead>
                  <TableBody>
                    {viewIngredients.map((ing, i) => (
                      <TableRow key={`${ing.rawItemId}-${i}`}>
                        <TableCell className="font-medium"><Link href={routes.traceSearch(shopId, { itemId: ing.rawItemId })} className="text-primary-700 hover:underline">{ing.rawItemId}</Link></TableCell>
                        <TableCell>{ing.rawItemName}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatQuantity(ing.quantityPerUnit, ing.unit)}</TableCell>
                        <TableCell>{ing.unit}</TableCell>
                        <TableCell className="text-right tabular-nums">{ing.unitCost != null && ing.unitCost > 0 ? formatCurrency(ing.unitCost) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {data.notes ? <Card className="p-4"><p className="text-xs uppercase text-ink-faint">Notes</p><p className="mt-1 text-sm">{data.notes}</p></Card> : null}
        </>
      )}
    </div>
  );
}
