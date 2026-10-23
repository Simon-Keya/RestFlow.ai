// apps/web/src/features/inventory/constants.ts
import {
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_GROUPS,
  DEFAULT_CATEGORY,
} from "@/lib/catalog/ingredient-categories";

export {
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_GROUPS,
  DEFAULT_CATEGORY,
};

/** Filter dropdown: All + Michael's 15 categories */
export const INVENTORY_CATEGORIES = [
  { value: "all", label: "All categories" },
  ...INGREDIENT_CATEGORIES.map((c) => ({ value: c, label: c })),
] as const;

export const STOCK_STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "in-stock", label: "In stock" },
  { value: "low-stock", label: "Low stock" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "near-expiry", label: "Near expiry" },
  { value: "expired", label: "Expired" },
] as const;
