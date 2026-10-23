import { BadRequestException, Injectable } from '@nestjs/common';
import {
  UnitConversionError,
  type UnitFamily,
} from './unit-conversion.types';

/**
 * Single source of truth for unit conversion (mass / volume / count).
 * Used by recipe COGS, stock deductions, waste, production, etc.
 *
 * Base units: g, ml, pcs
 */
@Injectable()
export class UnitConversionService {
  private static readonly ALIASES: Record<string, string> = {
    kilogram: 'kg',
    kilograms: 'kg',
    kilo: 'kg',
    gram: 'g',
    grams: 'g',
    gms: 'g',
    gm: 'g',
    milligram: 'mg',
    milligrams: 'mg',
    litre: 'l',
    liter: 'l',
    litres: 'l',
    liters: 'l',
    lt: 'l',
    millilitre: 'ml',
    milliliter: 'ml',
    millilitres: 'ml',
    milliliters: 'ml',
    piece: 'pcs',
    pieces: 'pcs',
    pc: 'pcs',
    unit: 'pcs',
    units: 'pcs',
    each: 'pcs',
    ea: 'pcs',
    // Pack / case style units — treated as countable stock (1 CS = 1 pcs in storage)
    cs: 'pcs',
    case: 'pcs',
    cases: 'pcs',
    box: 'pcs',
    boxes: 'pcs',
    pack: 'pcs',
    packs: 'pcs',
    pkt: 'pcs',
    packet: 'pcs',
    packets: 'pcs',
    bottle: 'pcs',
    bottles: 'pcs',
    can: 'pcs',
    cans: 'pcs',
    tin: 'pcs',
    tins: 'pcs',
    tray: 'pcs',
    trays: 'pcs',
    bag: 'pcs',
    bags: 'pcs',
    portion: 'pcs',
    portions: 'pcs',
    serving: 'pcs',
    servings: 'pcs',
  };

  /** factor to convert 1 of this unit into base (g / ml / pcs) */
  private static readonly TO_BASE: Record<
    string,
    { family: UnitFamily; factor: number }
  > = {
    mg: { family: 'mass', factor: 0.001 },
    g: { family: 'mass', factor: 1 },
    kg: { family: 'mass', factor: 1000 },
    ml: { family: 'volume', factor: 1 },
    l: { family: 'volume', factor: 1000 },
    pcs: { family: 'count', factor: 1 },
  };

  normalizeUnit(unit: string | null | undefined): string {
    if (unit == null || !String(unit).trim()) return 'pcs';
    let u = String(unit).trim().toLowerCase();
    u = UnitConversionService.ALIASES[u] ?? u;
    // common recipe typos
    if (u === 'kgs') u = 'kg';
    if (u === 'gr') u = 'g';
    // unknown discrete tokens → pcs (safer for POS than hard-fail)
    if (!(u in UnitConversionService.TO_BASE) && u.length <= 6) {
      const discrete = new Set([
        'cs',
        'case',
        'box',
        'pack',
        'pkt',
        'can',
        'tin',
        'bag',
        'tray',
      ]);
      if (discrete.has(u)) u = 'pcs';
    }
    return u;
  }

  getFamily(unit: string | null | undefined): UnitFamily | null {
    const n = this.normalizeUnit(unit);
    return UnitConversionService.TO_BASE[n]?.family ?? null;
  }

  areCompatible(
    fromUnit: string | null | undefined,
    toUnit: string | null | undefined,
  ): boolean {
    const a = this.getFamily(fromUnit);
    const b = this.getFamily(toUnit);
    return a != null && b != null && a === b;
  }

  /**
   * Convert quantity from one unit to another (same family only).
   */
  convert(
    quantity: number,
    fromUnit: string | null | undefined,
    toUnit: string | null | undefined,
  ): number {
    if (!Number.isFinite(quantity) || quantity === 0) return 0;

    const from = this.normalizeUnit(fromUnit);
    const to = this.normalizeUnit(toUnit);

    if (from === to) return quantity;

    const fromMeta = UnitConversionService.TO_BASE[from];
    const toMeta = UnitConversionService.TO_BASE[to];

    if (!fromMeta) {
      throw new UnitConversionError(
        `Unknown unit "${fromUnit ?? ''}". Use g/kg, ml/L, or pcs.`,
      );
    }
    if (!toMeta) {
      throw new UnitConversionError(
        `Unknown unit "${toUnit ?? ''}". Use g/kg, ml/L, or pcs.`,
      );
    }
    if (fromMeta.family !== toMeta.family) {
      throw new UnitConversionError(
        `Cannot convert ${from} (${fromMeta.family}) to ${to} (${toMeta.family}). Units must be the same type.`,
      );
    }

    const inBase = quantity * fromMeta.factor;
    return inBase / toMeta.factor;
  }

  /** Convert qty into the unit unitCost is expressed in (usually item storage unit). */
  qtyInCostUnit(
    qty: number,
    qtyUnit: string | null | undefined,
    costUnit: string | null | undefined,
  ): number {
    return this.convert(qty, qtyUnit, costUnit);
  }

  /**
   * lineCost = convertedQty × unitCost (money rounded to 2 dp).
   * Throws BadRequestException on incompatible/unknown units.
   */
  lineCost(
    qty: number,
    qtyUnit: string | null | undefined,
    unitCost: number,
    costUnit: string | null | undefined,
  ): number {
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    if (!Number.isFinite(unitCost) || unitCost <= 0) return 0;

    try {
      const q = this.qtyInCostUnit(qty, qtyUnit, costUnit);
      return Math.round(q * unitCost * 100) / 100;
    } catch (e) {
      const msg =
        e instanceof UnitConversionError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Unit conversion failed';
      throw new BadRequestException(msg);
    }
  }

  /** Safe convert for stock deductions — wraps errors as BadRequestException */
  convertOrThrow(
    quantity: number,
    fromUnit: string | null | undefined,
    toUnit: string | null | undefined,
  ): number {
    try {
      return this.convert(quantity, fromUnit, toUnit);
    } catch (e) {
      const msg =
        e instanceof UnitConversionError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Unit conversion failed';
      throw new BadRequestException(msg);
    }
  }
}
