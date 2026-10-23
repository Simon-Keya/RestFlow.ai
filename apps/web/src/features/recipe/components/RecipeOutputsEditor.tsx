"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { RECIPE_UNITS } from "../constants";

export type OutputDraft = {
  itemId: string;
  itemName: string;
  /** Optional example only — not used as production truth */
  standardQuantity: string;
  unit: string;
  /** Fixed weight per piece (e.g. 250) */
  unitWeight: string;
  weightUnit: string;
  isDefault: boolean;
};

export const EMPTY_OUTPUT: OutputDraft = {
  itemId: "",
  itemName: "",
  standardQuantity: "",
  unit: "pcs",
  unitWeight: "",
  weightUnit: "g",
  isDefault: false,
};

const WEIGHT_UNITS = [
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "L", label: "L" },
];

function toKg(qty: number, weight: number, weightUnit: string): number {
  const w = qty * weight;
  const u = weightUnit.toLowerCase();
  if (u === "g") return w / 1000;
  if (u === "kg") return w;
  if (u === "ml") return w / 1000;
  if (u === "l") return w;
  return w;
}

export function RecipeOutputsEditor({
  rows,
  onChange,
  disabled,
  targetYieldKg,
}: {
  rows: OutputDraft[];
  onChange: (rows: OutputDraft[]) => void;
  disabled?: boolean;
  /** Recipe standard yield in kg (optional live check when example qtys filled) */
  targetYieldKg?: number;
}) {
  function update(index: number, patch: Partial<OutputDraft>) {
    onChange(
      rows.map((row, i) => {
        if (i !== index) {
          if (patch.isDefault) return { ...row, isDefault: false };
          return row;
        }
        return { ...row, ...patch };
      }),
    );
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function add() {
    onChange([
      ...rows,
      {
        ...EMPTY_OUTPUT,
        isDefault: rows.length === 0,
      },
    ]);
  }

  const exampleTotalKg = rows.reduce((sum, row) => {
    const q = Number(row.standardQuantity);
    const w = Number(row.unitWeight);
    if (!Number.isFinite(q) || !Number.isFinite(w) || q <= 0 || w <= 0) {
      return sum;
    }
    return sum + toKg(q, w, row.weightUnit || "g");
  }, 0);

  const target =
    targetYieldKg != null && Number.isFinite(targetYieldKg)
      ? targetYieldKg
      : null;
  const match =
    target != null &&
    exampleTotalKg > 0 &&
    Math.abs(exampleTotalKg - target) < 0.001;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Outputs (sizes)</p>
          <p className="text-xs text-ink-muted">
            Set fixed weight per piece (e.g. Large 250g). Production enters
            whole-number counts later — not here.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={add}
          disabled={disabled}
        >
          <Plus className="h-3.5 w-3.5" /> Add size
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No sizes yet — add at least two for multi-output (e.g. S / M / L).
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const w = Number(row.unitWeight);
            const q = Number(row.standardQuantity);
            const sub =
              Number.isFinite(w) &&
              w > 0 &&
              Number.isFinite(q) &&
              q > 0
                ? toKg(q, w, row.weightUnit || "g")
                : null;

            return (
              <div
                key={index}
                className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 md:grid-cols-12"
              >
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-ink-muted">
                    SKU *
                  </label>
                  <Input
                    value={row.itemId}
                    onChange={(e) => update(index, { itemId: e.target.value })}
                    placeholder="DOUGH-L"
                    disabled={disabled}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-ink-muted">
                    Name
                  </label>
                  <Input
                    value={row.itemName}
                    onChange={(e) =>
                      update(index, { itemName: e.target.value })
                    }
                    placeholder="Large ball"
                    disabled={disabled}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-ink-muted">
                    Weight / piece *
                  </label>
                  <Input
                    type="number"
                    min="0.001"
                    step="any"
                    value={row.unitWeight}
                    onChange={(e) =>
                      update(index, { unitWeight: e.target.value })
                    }
                    placeholder="250"
                    disabled={disabled}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="mb-1 block text-xs text-ink-muted">
                    Wt unit
                  </label>
                  <Select
                    value={row.weightUnit || "g"}
                    onValueChange={(value) =>
                      update(index, { weightUnit: value })
                    }
                    options={WEIGHT_UNITS}
                    disabled={disabled}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="mb-1 block text-xs text-ink-muted">
                    Count unit
                  </label>
                  <Select
                    value={row.unit}
                    onValueChange={(value) => update(index, { unit: value })}
                    options={RECIPE_UNITS.map((u) => ({
                      value: u.value,
                      label: u.label,
                    }))}
                    disabled={disabled}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-ink-muted">
                    Example qty (optional)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={row.standardQuantity}
                    onChange={(e) =>
                      update(index, { standardQuantity: e.target.value })
                    }
                    placeholder="—"
                    disabled={disabled}
                  />
                  {sub != null ? (
                    <p className="mt-0.5 text-[10px] text-ink-faint">
                      ≈ {sub.toFixed(3)} kg
                    </p>
                  ) : null}
                </div>
                <div className="flex items-end gap-2 md:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={row.isDefault ? "primary" : "secondary"}
                    onClick={() => update(index, { isDefault: true })}
                    disabled={disabled}
                  >
                    {row.isDefault ? "Default" : "Default"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => remove(index)}
                    disabled={disabled}
                    aria-label="Remove output"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {exampleTotalKg > 0 ? (
        <p
          className={`text-xs ${
            target != null
              ? match
                ? "text-emerald-700"
                : "text-amber-700"
              : "text-ink-muted"
          }`}
        >
          Example mix total ≈ {exampleTotalKg.toFixed(3)} kg
          {target != null
            ? match
              ? ` · matches yield ${target} kg`
              : ` · target ${target} kg (informational only)`
            : null}
        </p>
      ) : null}
    </div>
  );
}