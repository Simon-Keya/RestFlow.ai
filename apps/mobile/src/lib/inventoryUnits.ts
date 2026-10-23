export const INVENTORY_UNITS = [
  'kg',
  'g',
  'L',
  'ml',
  'pcs',
  'units',
  'bag',
  'box',
  'crate',
  'carton',
  'dozen',
  'tray',
  'bunch',
  'pack',
] as const;

export type InventoryUnit = (typeof INVENTORY_UNITS)[number];
export const DEFAULT_INVENTORY_UNIT: InventoryUnit = 'kg';
