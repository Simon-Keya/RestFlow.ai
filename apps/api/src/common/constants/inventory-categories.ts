import {
  INGREDIENT_CATEGORIES,
  type IngredientCategory,
  isAllowedIngredientCategory,
  normalizeIngredientCategory,
} from './ingredient-categories';

export const INVENTORY_CATEGORIES = INGREDIENT_CATEGORIES;
export type InventoryCategory = IngredientCategory;
export { isAllowedIngredientCategory as isInventoryCategory };

/**
 * Always returns a canonical category string (with fallback).
 */
export function normalizeInventoryCategory(
  value: string | null | undefined,
  fallback: string = 'Packaging & Consumables',
): string {
  return normalizeIngredientCategory(value) ?? fallback;
}
