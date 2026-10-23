// apps/api/src/common/utils/stock-units.ts
/**
 * Canonical stock units (RestFlow / MEKU):
 *   mass   → grams (g)
 *   volume → millilitres (ml)
 *   count  → pcs (unchanged)
 *
 * When converting kg→g or L→ml: quantity × 1000, unit cost ÷ 1000
 * so line value (qty × unit_cost) is unchanged.
 */
import {
  normalizeUnit,
  convertQuantity,
  toBaseQuantity,
} from './units.utils';

export type CanonicalUnit = 'g' | 'ml' | 'pcs' | string;

export interface NormalizedStockQty {
  quantity: number;
  unit: string;
  unitCost: number;
  /** True when kg→g or L→ml (or equivalent) was applied */
  converted: boolean;
  dimension: 'mass' | 'volume' | 'count' | 'other';
}

/** Storage unit for a given label: kg/g → g, L/ml → ml, else normalized label. */
export function canonicalStorageUnit(
  unit: string | null | undefined,
): CanonicalUnit {
  const u = normalizeUnit(unit);
  if (u === 'kg' || u === 'g') return 'g';
  if (u === 'l' || u === 'ml') return 'ml';
  if (u === 'pcs') return 'pcs';
  return u || 'pcs';
}

/**
 * Normalize quantity + unit cost into canonical storage units.
 * Safe for pcs / pkts / scoops (no scale).
 */
export function toCanonicalStockQty(
  quantity: number,
  unit: string | null | undefined,
  unitCost: number = 0,
): NormalizedStockQty {
  const q = Number.isFinite(quantity) ? quantity : 0;
  const c = Number.isFinite(unitCost) ? unitCost : 0;
  const base = toBaseQuantity(q, unit);
  const u = normalizeUnit(unit);

  if (base.dimension === 'mass') {
    // unit cost: if input was per kg, divide by 1000 → per g
    const costPerG = u === 'kg' ? c / 1000 : c;
    return {
      quantity: base.value,
      unit: 'g',
      unitCost: costPerG,
      converted: u === 'kg',
      dimension: 'mass',
    };
  }
  if (base.dimension === 'volume') {
    const costPerMl = u === 'l' ? c / 1000 : c;
    return {
      quantity: base.value,
      unit: 'ml',
      unitCost: costPerMl,
      converted: u === 'l',
      dimension: 'volume',
    };
  }
  if (base.dimension === 'count') {
    return {
      quantity: q,
      unit: 'pcs',
      unitCost: c,
      converted: false,
      dimension: 'count',
    };
  }
  return {
    quantity: q,
    unit: u || 'pcs',
    unitCost: c,
    converted: false,
    dimension: 'other',
  };
}

/** Alias used in older patches */
export function normalizeStockQtyCost(
  quantity: number,
  unit: string,
  unitCost: number,
): { quantity: number; unit: string; unitCost: number } {
  const n = toCanonicalStockQty(quantity, unit, unitCost);
  return { quantity: n.quantity, unit: n.unit, unitCost: n.unitCost };
}

/**
 * Convert a quantity from `fromUnit` into the item's stored unit
 * (what InventoryProjection.available_stock is denominated in).
 */
export function quantityInItemUnit(
  quantity: number,
  fromUnit: string | null | undefined,
  itemUnit: string | null | undefined,
): number {
  if (!Number.isFinite(quantity)) return 0;
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(itemUnit);
  if (!to || from === to) return quantity;
  const converted = convertQuantity(quantity, from, to);
  return Number.isFinite(converted) ? converted : quantity;
}

/**
 * If item storage unit changes kg→g or L→ml, scale on-hand so the physical
 * amount is unchanged (on_hand_kg * 1000 = on_hand_g).
 */
export function scaleFactorForUnitChange(
  previousUnit: string | null | undefined,
  nextUnit: string | null | undefined,
): number {
  const prev = normalizeUnit(previousUnit);
  const next = normalizeUnit(nextUnit);
  if (prev === next) return 1;
  if (prev === 'kg' && next === 'g') return 1000;
  if (prev === 'g' && next === 'kg') return 1 / 1000;
  if (prev === 'l' && next === 'ml') return 1000;
  if (prev === 'ml' && next === 'l') return 1 / 1000;
  // Already canonical pair via toCanonical
  const prevC = canonicalStorageUnit(prev);
  const nextC = canonicalStorageUnit(next);
  if (prevC === nextC) {
    // e.g. kg → g already handled; g → g
    if (prev === 'kg' && nextC === 'g') return 1000;
    if (prev === 'l' && nextC === 'ml') return 1000;
  }
  return 1;
}
