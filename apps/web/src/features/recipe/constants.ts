export const RECIPE_UNITS = [
  { value: "portion", label: "Portion" },
  { value: "plate", label: "Plate" },
  { value: "pcs", label: "Pieces" },
  { value: "kg", label: "Kilogram" },
  { value: "g", label: "Gram" },
  { value: "L", label: "Litre" },
  { value: "ml", label: "Millilitre" },
] as const;

/** Suggestions only — managers may type a new recipe category */
export const RECIPE_CATEGORIES = [
  { value: "Bakery", label: "Bakery" },
  { value: "Hot kitchen", label: "Hot kitchen" },
  { value: "Cold kitchen", label: "Cold kitchen" },
  { value: "Dough", label: "Dough" },
  { value: "Beverage", label: "Beverage" },
  { value: "Other", label: "Other" },
] as const;

/** Inventory Item.category — raw / supply taxonomy */
export const ITEM_FOOD_CATEGORIES = [
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

export const INGREDIENT_UNITS = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "L", label: "L" },
  { value: "ml", label: "ml" },
  { value: "pcs", label: "pcs" },
  { value: "units", label: "units" },
] as const;

export const EMPTY_INGREDIENT = {
  rawItemId: "",
  rawItemName: "",
  quantityPerUnit: "",
  unit: "kg",
  unitCost: "",
};