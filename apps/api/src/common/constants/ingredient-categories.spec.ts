import {
  isAllowedIngredientCategory,
  normalizeIngredientCategory,
} from './ingredient-categories';

describe('ingredient categories (canonical inventory list)', () => {
  it('accepts Meat & Poultry', () => {
    expect(isAllowedIngredientCategory('Meat & Poultry')).toBe(true);
    expect(normalizeIngredientCategory('Meat & Poultry')).toBe('Meat & Poultry');
  });

  it('accepts case-insensitive match', () => {
    expect(normalizeIngredientCategory('meat & poultry')).toBe('Meat & Poultry');
  });

  it('maps legacy leaf Chicken → Meat & Poultry', () => {
    expect(normalizeIngredientCategory('Chicken')).toBe('Meat & Poultry');
    expect(isAllowedIngredientCategory('Chicken')).toBe(true);
  });

  it('rejects unknown categories', () => {
    expect(normalizeIngredientCategory('NotARealCategory')).toBeUndefined();
    expect(isAllowedIngredientCategory('NotARealCategory')).toBe(false);
  });
});
