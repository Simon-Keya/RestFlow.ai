// apps/api/src/common/utils/units.util.ts

/** Normalize unit labels for comparison / conversion. */
export function normalizeUnit(unit: string | null | undefined): string {
  const u = (unit ?? '').trim().toLowerCase();
  if (!u) return 'pcs';
  if (u === 'kgs' || u === 'kilogram' || u === 'kilograms') return 'kg';
  if (u === 'grams' || u === 'gram') return 'g';
  if (
    u === 'litre' ||
    u === 'liter' ||
    u === 'litres' ||
    u === 'liters' ||
    u === 'lt'
  )
    return 'l';
  if (u === 'millilitre' || u === 'milliliter' || u === 'milliliters')
    return 'ml';
  if (
    u === 'pieces' ||
    u === 'piece' ||
    u === 'pc' ||
    u === 'unit' ||
    u === 'units'
  )
    return 'pcs';
  return u;
}

/**
 * Convert quantity into a shared base dimension when possible.
 * mass → grams, volume → ml, count → pcs
 */
export function toBaseQuantity(
  quantity: number,
  unit: string | null | undefined,
): { value: number; dimension: 'mass' | 'volume' | 'count' | 'other' } {
  const u = normalizeUnit(unit);
  const q = Number.isFinite(quantity) ? quantity : 0;

  if (u === 'kg') return { value: q * 1000, dimension: 'mass' };
  if (u === 'g') return { value: q, dimension: 'mass' };
  if (u === 'l') return { value: q * 1000, dimension: 'volume' };
  if (u === 'ml') return { value: q, dimension: 'volume' };
  if (u === 'pcs') return { value: q, dimension: 'count' };

  return { value: q, dimension: 'other' };
}

/**
 * Convert `quantity` from `fromUnit` into `toUnit` when dimensions match.
 * If units are incompatible, returns `quantity` unchanged.
 */
export function convertQuantity(
  quantity: number,
  fromUnit: string | null | undefined,
  toUnit: string | null | undefined,
): number {
  const from = toBaseQuantity(quantity, fromUnit);
  const oneTo = toBaseQuantity(1, toUnit);

  if (from.dimension === 'other' || oneTo.dimension === 'other') {
    return quantity;
  }
  if (from.dimension !== oneTo.dimension) {
    return quantity;
  }
  if (oneTo.value === 0) return quantity;
  return from.value / oneTo.value;
}

/** How many whole portions can be made from available stock given need-per-portion. */
export function portionsFromStock(
  availableQty: number,
  availableUnit: string | null | undefined,
  needPerPortion: number,
  needUnit: string | null | undefined,
): number {
  if (needPerPortion <= 0) return Number.POSITIVE_INFINITY;
  const availableInNeedUnits = convertQuantity(
    availableQty,
    availableUnit,
    needUnit,
  );
  if (!Number.isFinite(availableInNeedUnits) || availableInNeedUnits <= 0) {
    return 0;
  }
  return Math.floor(availableInNeedUnits / needPerPortion);
}


/** @deprecated prefer toCanonicalStockQty from stock-units */
export function normalizeStockQtyCost(
  quantity: number,
  unit: string,
  unitCost: number,
): { quantity: number; unit: string; unitCost: number } {
  const u = normalizeUnit(unit);
  if (u === 'kg') {
    return { quantity: quantity * 1000, unit: 'g', unitCost: unitCost / 1000 };
  }
  if (u === 'l') {
    return { quantity: quantity * 1000, unit: 'ml', unitCost: unitCost / 1000 };
  }
  return { quantity, unit: u || unit, unitCost };
}
