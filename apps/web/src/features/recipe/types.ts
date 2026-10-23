// apps/web/src/features/recipes/types.ts

export interface RecipeIngredient {
  rawItemId: string;
  rawItemName: string;
  /** Alias used by some kitchen UI — same as rawItemName when mapped */
  name?: string;
  quantityPerUnit: number;
  unit: string;
  /** Live inventory WAC (KES per unit) */
  unitCost?: number | null;
  /** qty × unitCost for one batch */
  lineCost?: number | null;
  costMissing?: boolean;
}

export interface RecipeOutput {
  id?: string;
  itemId: string;
  itemName: string;
  /** Optional example mix only — not production truth */
  standardQuantity: number | null;
  unit: string;
  /** Fixed weight per piece (e.g. 250) — required for MULTI_OUTPUT */
  unitWeight: number | null;
  weightUnit: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export type RecipeType =
  | "SINGLE_OUTPUT"
  | "PORTION_OUTPUT"
  | "MULTI_OUTPUT"
  | "ASSEMBLY"
  | "CONVERSION"
  | "CO_PRODUCT"
  | "SUB_RECIPE";

export interface Recipe {
  recipeId: string;
  itemId: string;
  name: string;
  standardYield: number;
  unit: string;
  notes?: string | null;
  /** Operational group (Bakery, Hot kitchen…) — free-text + suggestions */
  category?: string | null;
  recipeType?: RecipeType;
  yieldQuantity?: number;
  yieldUnit?: string;
  yieldBasis?: "BATCH" | "UNIT";
  ingredients: RecipeIngredient[];
  outputs: RecipeOutput[];
  /** Σ ingredient line costs (one batch) */
  batchCost?: number | null;
  /** batchCost / standardYield */
  stdUnitCost?: number | null;
  costMissing?: boolean;
  createdAt?: string;
  updatedAt?: string;
}