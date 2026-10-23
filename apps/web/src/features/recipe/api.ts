// apps/web/src/features/recipes/api.ts
import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { asArray, buildQueryString } from "@/lib/utils";
import type { Recipe, RecipeIngredient, RecipeOutput } from "./types";
import type { CreateRecipeInput, UpdateRecipeInput } from "./schema";

function toIngredient(raw: Record<string, unknown>): RecipeIngredient {
  return {
    rawItemId: String(raw.rawItemId ?? raw.raw_item_id ?? ""),
    rawItemName: String(raw.rawItemName ?? raw.raw_item_name ?? ""),
    quantityPerUnit: Number(
      raw.quantityPerUnit ?? raw.quantity_per_unit ?? 0,
    ),
    unit: String(raw.unit ?? "pcs"),
    unitCost:
      raw.unitCost != null || raw.unit_cost != null
        ? Number(raw.unitCost ?? raw.unit_cost)
        : null,
    lineCost: Number(raw.lineCost ?? raw.line_cost ?? 0),
    costMissing: Boolean(raw.costMissing ?? raw.cost_missing),
  };
}

function toOutput(raw: Record<string, unknown>): RecipeOutput {
  return {
    id: raw.id != null ? String(raw.id) : undefined,
    itemId: String(raw.itemId ?? raw.item_id ?? ""),
    itemName: String(raw.itemName ?? raw.item_name ?? raw.item_id ?? ""),
    standardQuantity:
      raw.standardQuantity != null || raw.standard_quantity != null
        ? Number(raw.standardQuantity ?? raw.standard_quantity)
        : null,
    unit: String(raw.unit ?? "pcs"),
    unitWeight:
      raw.unitWeight != null || raw.unit_weight != null
        ? Number(raw.unitWeight ?? raw.unit_weight)
        : null,
    weightUnit:
      raw.weightUnit != null || raw.weight_unit != null
        ? String(raw.weightUnit ?? raw.weight_unit)
        : null,
    isDefault: Boolean(raw.isDefault ?? raw.is_default ?? false),
    isActive: Boolean(raw.isActive ?? raw.is_active ?? true),
  };
}

function toRecipe(raw: Record<string, unknown>): Recipe {
  const ingredients = asArray<Record<string, unknown>>(raw.ingredients).map(
    toIngredient,
  );
  const outputs = asArray<Record<string, unknown>>(raw.outputs).map(toOutput);

  return {
    recipeId: String(raw.recipeId ?? raw.recipe_id ?? raw.id ?? ""),
    itemId: String(raw.itemId ?? raw.item_id ?? ""),
    name: String(raw.name ?? raw.item_name ?? raw.itemName ?? ""),
    standardYield: Number(raw.standardYield ?? raw.standard_yield ?? 1),
    batchCost: Number(raw.batchCost ?? raw.batch_cost ?? 0),
    stdUnitCost: Number(raw.stdUnitCost ?? raw.std_unit_cost ?? 0),
    costMissing: Boolean(raw.costMissing ?? raw.cost_missing),
    unit: String(raw.unit ?? "portion"),
    notes: raw.notes != null ? String(raw.notes) : null,
    category:
      raw.category != null && String(raw.category).trim()
        ? String(raw.category)
        : null,
    recipeType: (raw.recipeType ??
      raw.recipe_type ??
      "SINGLE_OUTPUT") as Recipe["recipeType"],
    yieldQuantity: Number(
      raw.yieldQuantity ?? raw.yield_quantity ?? raw.standard_yield ?? 1,
    ),
    yieldUnit: String(raw.yieldUnit ?? raw.yield_unit ?? raw.unit ?? "portion"),
    yieldBasis: (raw.yieldBasis ??
      raw.yield_basis ??
      "BATCH") as Recipe["yieldBasis"],
    ingredients,
    outputs,
    createdAt: raw.createdAt
      ? String(raw.createdAt)
      : raw.created_at
        ? String(raw.created_at)
        : undefined,
    updatedAt: raw.updatedAt
      ? String(raw.updatedAt)
      : raw.updated_at
        ? String(raw.updated_at)
        : undefined,
  };
}

export const recipeApi = {
  async list(shopId: string, category?: string): Promise<Recipe[]> {
    try {
      const { data } = await apiClient.get(
        `${endpoints.recipe.list}${buildQueryString({
          shopId,
          ...(category && category.trim() ? { category: category.trim() } : {}),
        })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const rows = asArray<Record<string, unknown>>(root.items ?? data);
      return rows.map(toRecipe).filter((r) => r.recipeId || r.itemId);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async get(recipeId: string): Promise<Recipe> {
    try {
      const { data } = await apiClient.get(endpoints.recipe.detail(recipeId));
      return toRecipe((data ?? {}) as Record<string, unknown>);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getById(recipeId: string): Promise<Recipe> {
    return this.get(recipeId);
  },

  async getByItemId(itemId: string): Promise<Recipe> {
    try {
      const { data } = await apiClient.get(endpoints.recipe.byItem(itemId));
      return toRecipe((data ?? {}) as Record<string, unknown>);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async create(input: CreateRecipeInput): Promise<{ recipeId: string }> {
    try {
      const body = {
        item_id: input.itemId,
        item_name: input.itemName,
        standard_yield: input.standardYield,
        unit: input.unit,
        notes: input.notes,
        category: input.category,
        recipe_type: input.recipeType ?? "SINGLE_OUTPUT",
        yield_quantity: input.yieldQuantity ?? input.standardYield,
        yield_unit: input.yieldUnit ?? input.unit,
        yield_basis: input.yieldBasis ?? "BATCH",
        ingredients: input.ingredients.map((ing) => ({
          raw_item_id: ing.rawItemId,
          raw_item_name: ing.rawItemName,
          quantity_per_unit: ing.quantityPerUnit,
          unit: ing.unit,
          unit_cost: ing.unitCost ?? undefined,
        })),
        outputs: input.outputs?.map((o, index) => ({
          item_id: o.itemId,
          item_name: o.itemName,
          standard_quantity: o.standardQuantity ?? undefined,
          unit: o.unit,
          unit_weight: o.unitWeight ?? undefined,
          weight_unit: o.weightUnit ?? undefined,
          is_default: o.isDefault ?? index === 0,
        })),
      };

      const { data } = await apiClient.post(endpoints.recipe.create, body);
      const root = (data ?? {}) as Record<string, unknown>;
      const recipeId = String(
        root.recipeId ?? root.recipe_id ?? root.id ?? "",
      );

      if (!recipeId) {
        throw new Error("Recipe created but no recipeId returned");
      }

      return { recipeId };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async update(recipeId: string, input: UpdateRecipeInput): Promise<void> {
    try {
      await apiClient.put(endpoints.recipe.update(recipeId), {
        item_id: input.itemId,
        item_name: input.itemName,
        standard_yield: input.standardYield,
        unit: input.unit,
        notes: input.notes ?? undefined,
        category: input.category,
        recipe_type: input.recipeType,
        yield_quantity: input.yieldQuantity ?? input.standardYield,
        yield_unit: input.yieldUnit ?? input.unit,
        yield_basis: input.yieldBasis,
        ingredients: input.ingredients?.map((ing) => ({
          raw_item_id: ing.rawItemId,
          raw_item_name: ing.rawItemName,
          quantity_per_unit: ing.quantityPerUnit,
          unit: ing.unit,
          unit_cost: ing.unitCost ?? undefined,
        })),
        outputs: input.outputs?.map((o, index) => ({
          item_id: o.itemId,
          item_name: o.itemName,
          standard_quantity: o.standardQuantity ?? undefined,
          unit: o.unit,
          unit_weight: o.unitWeight,
          weight_unit: o.weightUnit ?? "g",
          is_default: o.isDefault ?? index === 0,
        })),
      });
    } catch (error) {
      throw toApiError(error);
    }
  },
};
