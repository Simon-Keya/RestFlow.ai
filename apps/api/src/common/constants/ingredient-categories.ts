/**
 * Canonical inventory / ingredient categories (Michael / MEKU list).
 * Used by POST /received, item creation, and validation.
 * Must stay in sync with apps/api/src/common/constants/inventory-categories.ts
 * and apps/web/src/lib/catalog/ingredient-categories.ts
 */

export type IngredientCategoryGroup = {
  group: string;
  items: string[];
};

/** Flat list — values stored on Item.category and accepted by ReceiveGoodsSchema */
export const INGREDIENT_CATEGORIES = [
  'Meat & Poultry',
  'Fish & Seafood',
  'Dairy & Eggs',
  'Fruits & Vegetables',
  'Grains, Cereals & Pulses',
  'Baking & Bakery',
  'Nuts, Seeds & Alternatives',
  'Herbs, Spices & Seasonings',
  'Oils, Sauces & Condiments',
  'Sweeteners & Food Ingredients',
  'Beverages',
  'Alcohol & Bar',
  'Frozen & Prepared Foods',
  'Packaging & Consumables',
  'Cleaning, Service & Equipment',
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export const INGREDIENT_CATEGORY_GROUPS: IngredientCategoryGroup[] = [
  {
    group: 'Food ingredients',
    items: [
      'Meat & Poultry',
      'Fish & Seafood',
      'Dairy & Eggs',
      'Fruits & Vegetables',
      'Grains, Cereals & Pulses',
      'Baking & Bakery',
      'Nuts, Seeds & Alternatives',
      'Herbs, Spices & Seasonings',
      'Oils, Sauces & Condiments',
      'Sweeteners & Food Ingredients',
      'Frozen & Prepared Foods',
    ],
  },
  {
    group: 'Drinks & ops',
    items: [
      'Beverages',
      'Alcohol & Bar',
      'Packaging & Consumables',
      'Cleaning, Service & Equipment',
    ],
  },
];

const ALLOWED = new Set(
  (INGREDIENT_CATEGORIES as readonly string[]).map((c) => c.toLowerCase()),
);

/** Map legacy leaf labels → canonical broad category */
const LEGACY_TO_CANONICAL: Record<string, IngredientCategory> = {
  beef: 'Meat & Poultry',
  goat: 'Meat & Poultry',
  'lamb/mutton': 'Meat & Poultry',
  pork: 'Meat & Poultry',
  veal: 'Meat & Poultry',
  game: 'Meat & Poultry',
  chicken: 'Meat & Poultry',
  turkey: 'Meat & Poultry',
  duck: 'Meat & Poultry',
  'other poultry': 'Meat & Poultry',
  wings: 'Meat & Poultry',
  fish: 'Fish & Seafood',
  seafood: 'Fish & Seafood',
  milk: 'Dairy & Eggs',
  cream: 'Dairy & Eggs',
  butter: 'Dairy & Eggs',
  cheese: 'Dairy & Eggs',
  yoghurt: 'Dairy & Eggs',
  yogurt: 'Dairy & Eggs',
  eggs: 'Dairy & Eggs',
  rice: 'Grains, Cereals & Pulses',
  'maize/corn': 'Grains, Cereals & Pulses',
  flour: 'Baking & Bakery',
  sugar: 'Sweeteners & Food Ingredients',
  tea: 'Beverages',
  coffee: 'Beverages',
  mayonnaise: 'Oils, Sauces & Condiments',
  'cooking oil': 'Oils, Sauces & Condiments',
  general: 'Packaging & Consumables',
};

export function isAllowedIngredientCategory(value: string): boolean {
  const v = value.trim().toLowerCase();
  return ALLOWED.has(v) || v in LEGACY_TO_CANONICAL;
}

/**
 * Normalize to a canonical category label, or undefined if empty/unknown.
 */
export function normalizeIngredientCategory(
  value: string | undefined | null,
): string | undefined {
  if (!value?.trim()) return undefined;
  const raw = value.trim();
  const lower = raw.toLowerCase();

  const exact = (INGREDIENT_CATEGORIES as readonly string[]).find(
    (c) => c.toLowerCase() === lower,
  );
  if (exact) return exact;

  if (LEGACY_TO_CANONICAL[lower]) return LEGACY_TO_CANONICAL[lower];

  return undefined;
}
