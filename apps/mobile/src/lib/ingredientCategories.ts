// apps/mobile/src/lib/ingredientCategories.ts

export type IngredientCategoryGroup = {
  group: string;
  items: string[];
};

/** Raw inventory taxonomy only — not FinishedGoodCategory */
export const INGREDIENT_CATEGORY_GROUPS: IngredientCategoryGroup[] = [
  {
    group: 'Meat',
    items: ['Beef', 'Goat', 'Lamb/Mutton', 'Pork', 'Veal', 'Game'],
  },
  {
    group: 'Poultry',
    items: ['Chicken', 'Turkey', 'Duck', 'Other Poultry'],
  },
  {
    group: 'Vegetables & Herbs',
    items: [
      'Leafy Vegetables',
      'Root Vegetables',
      'Tubers',
      'Onions',
      'Tomatoes',
    ],
  },
  {
    group: 'Fruits',
    items: ['Citrus', 'Berries', 'Tropical Fruits', 'Melons'],
  },
  {
    group: 'Dairy & Eggs',
    items: ['Milk', 'Cream', 'Butter', 'Cheese', 'Yoghurt', 'Eggs'],
  },
  {
    group: 'Grains & Legumes',
    items: [
      'Rice',
      'Maize/Corn',
      'Oats',
      'Beans',
      'Lentils',
      'Peas',
      'Green Grams',
    ],
  },
  {
    group: 'Spices & Seasonings',
    items: [
      'Black Pepper',
      'White Pepper',
      'Paprika',
      'Cayenne',
      'Curry Powder',
      'Turmeric',
      'Cumin',
      'Coriander',
      'Cinnamon',
    ],
  },
  {
    group: 'Oils, Fats, Sauces & Condiments',
    items: [
      'Cooking Oil',
      'Olive Oil',
      'Sesame Oil',
      'Tomato Sauce',
      'Mayonnaise',
      'Soy Sauce',
      'Chilli Sauce',
      'BBQ Sauce',
    ],
  },
  {
    group: 'Nuts, Seeds & Baking Ingredients',
    items: ['Peanuts', 'Almonds', 'Cashewnut', 'Sesame', 'Sunflower Seeds'],
  },
  {
    group: 'Beverage Ingredients',
    items: ['Coffee', 'Tea', 'Cocoa'],
  },
  {
    group: 'Bar & Specialty Ingredients',
    items: [
      'Cocktail Syrups',
      'Bitters',
      'Cocktail Fruits',
      'Cocktail Herbs',
    ],
  },
];

export const INGREDIENT_CATEGORIES: string[] =
  INGREDIENT_CATEGORY_GROUPS.flatMap((g) => g.items);

export const DEFAULT_INGREDIENT_CATEGORY =
  INGREDIENT_CATEGORIES[0] ?? 'Chicken';