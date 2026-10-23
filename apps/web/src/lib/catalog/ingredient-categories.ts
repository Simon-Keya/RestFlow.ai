/**
 * Canonical inventory / ingredient categories (Michael / MEKU list).
 * Used by receive forms, filters, and validation — not leaf meat types.
 */

export const INGREDIENT_CATEGORIES = [
  "Meat & Poultry",
  "Fish & Seafood",
  "Dairy & Eggs",
  "Fruits & Vegetables",
  "Grains, Cereals & Pulses",
  "Baking & Bakery",
  "Nuts, Seeds & Alternatives",
  "Herbs, Spices & Seasonings",
  "Oils, Sauces & Condiments",
  "Sweeteners & Food Ingredients",
  "Beverages",
  "Alcohol & Bar",
  "Frozen & Prepared Foods",
  "Packaging & Consumables",
  "Cleaning, Service & Equipment",
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

/** Optional grouping for UI sections (same 15 categories). */
export type IngredientCategoryGroup = {
  group: string;
  items: string[];
};

export const INGREDIENT_CATEGORY_GROUPS: IngredientCategoryGroup[] = [
  {
    group: "Food ingredients",
    items: [
      "Meat & Poultry",
      "Fish & Seafood",
      "Dairy & Eggs",
      "Fruits & Vegetables",
      "Grains, Cereals & Pulses",
      "Baking & Bakery",
      "Nuts, Seeds & Alternatives",
      "Herbs, Spices & Seasonings",
      "Oils, Sauces & Condiments",
      "Sweeteners & Food Ingredients",
      "Frozen & Prepared Foods",
    ],
  },
  {
    group: "Drinks & ops",
    items: [
      "Beverages",
      "Alcohol & Bar",
      "Packaging & Consumables",
      "Cleaning, Service & Equipment",
    ],
  },
];

export const DEFAULT_CATEGORY: IngredientCategory = "Packaging & Consumables";
