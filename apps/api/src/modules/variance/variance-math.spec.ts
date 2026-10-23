import { computeProductionVarianceLines } from './variance-math';

describe('computeProductionVarianceLines', () => {
  it('scales per-unit recipes when yield is 1 (legacy)', () => {
    const r = computeProductionVarianceLines({
      productItemId: 'BREAD',
      productName: 'Bread',
      productUnit: 'loaf',
      plannedQuantity: 10,
      actualQuantityProduced: 8,
      recipeYield: 1,
      productUnitCost: 50,
      ingredients: [
        {
          raw_item_id: 'FLOUR',
          raw_item_name: 'Flour',
          quantity_per_unit: 0.5,
          unit: 'kg',
          unit_cost: 100,
        },
      ],
      tolerancePercent: 5,
    });
    expect(r.lines[0].item_id).toBe('BREAD');
    const flour = r.lines.find((l) => l.item_id === 'FLOUR')!;
    expect(flour.expected_quantity).toBe(5);
    expect(flour.actual_quantity).toBe(4);
  });

  it('Michael dough: planned 1000 g actual 1200 g yield 1000 — not pieces/planned', () => {
    const r = computeProductionVarianceLines({
      productItemId: 'PIZZA_DOUGH',
      productName: 'Pizza Dough',
      productUnit: 'g',
      plannedQuantity: 1000,
      actualQuantityProduced: 1200, // mass, NOT 3 pieces
      recipeYield: 1000,
      productUnitCost: 0.05,
      ingredients: [
        {
          raw_item_id: 'FLOUR',
          raw_item_name: 'Flour',
          quantity_per_unit: 1000,
          unit: 'g',
          unit_cost: 0.12,
        },
        {
          raw_item_id: 'YEAST',
          raw_item_name: 'Instant Yeast',
          quantity_per_unit: 8,
          unit: 'g',
          unit_cost: 1,
        },
        {
          raw_item_id: 'SALT',
          raw_item_name: 'Salt',
          quantity_per_unit: 12,
          unit: 'g',
          unit_cost: 0.1,
        },
      ],
      tolerancePercent: 5,
    });
    const flour = r.lines.find((l) => l.item_id === 'FLOUR')!;
    const yeast = r.lines.find((l) => l.item_id === 'YEAST')!;
    const dough = r.lines[0];
    expect(flour.expected_quantity).toBe(1000);
    expect(flour.actual_quantity).toBe(1200);
    expect(yeast.actual_quantity).toBeCloseTo(9.6, 5);
    expect(dough.actual_quantity).toBe(1200);
    // Regression: never the pieces/planned scale
    expect(flour.actual_quantity).not.toBe(3);
    expect(yeast.actual_quantity).not.toBeCloseTo(0.024, 5);
  });

  it('regression: never scale by piece_count/planned_grams', () => {
    const wrong = computeProductionVarianceLines({
      productItemId: 'X',
      productName: 'X',
      productUnit: 'g',
      plannedQuantity: 1000,
      actualQuantityProduced: 3, // WRONG input (pieces)
      recipeYield: 1000,
      ingredients: [
        {
          raw_item_id: 'FLOUR',
          raw_item_name: 'Flour',
          quantity_per_unit: 1000,
          unit: 'g',
          unit_cost: 0,
        },
      ],
      tolerancePercent: 5,
    });
    // With wrong input this would show 3 — production.service must not pass 3
    expect(wrong.lines.find((l) => l.item_id === 'FLOUR')!.actual_quantity).toBe(
      3,
    );
  });

  it('batch quantities yield 2500 planned 2500', () => {
    const r = computeProductionVarianceLines({
      productItemId: 'PIZZA_DOUGH',
      productName: 'Pizza Dough',
      productUnit: 'g',
      plannedQuantity: 2500,
      actualQuantityProduced: 2600,
      recipeYield: 2500,
      ingredients: [
        {
          raw_item_id: 'FLOUR',
          raw_item_name: 'Flour',
          quantity_per_unit: 2500,
          unit: 'g',
          unit_cost: 0.12,
        },
      ],
      tolerancePercent: 5,
    });
    expect(r.lines.find((l) => l.item_id === 'FLOUR')!.expected_quantity).toBe(
      2500,
    );
  });
});


  it('value_affected is FG only — does not sum ingredient lines (Michael double-count)', () => {
    const r = computeProductionVarianceLines({
      productItemId: 'PIZZA_DOUGH',
      productName: 'PIZZA DOUGH',
      productUnit: 'g',
      plannedQuantity: 1000,
      actualQuantityProduced: 800,
      recipeYield: 1000,
      productUnitCost: 0.18, // 200 g × 0.18 = 36
      ingredients: [
        {
          raw_item_id: 'FLOUR',
          raw_item_name: 'FLOUR',
          quantity_per_unit: 1000,
          unit: 'g',
          unit_cost: 0.12, // 200 × 0.12 = 24
        },
        {
          raw_item_id: 'YEAST',
          raw_item_name: 'INSTANT YEAST',
          quantity_per_unit: 8,
          unit: 'g',
          unit_cost: 0.6,
        },
      ],
      tolerancePercent: 5,
    });
    const dough = r.lines.find((l) => l.item_id === 'PIZZA_DOUGH')!;
    expect(dough.variance_value).toBe(36);
    // Must NOT be 36 + 24 + yeast…
    expect(r.value_affected).toBe(36);
    expect(r.value_affected).toBe(dough.variance_value);
  });
