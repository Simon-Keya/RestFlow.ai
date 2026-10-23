/** Standard units for Receive stock and inventory forms. */
export const INVENTORY_UNITS = [
  { value: "kg", label: "kg (kilogram)" },
  { value: "g", label: "g (gram)" },
  { value: "L", label: "L (litre)" },
  { value: "ml", label: "ml (millilitre)" },
  { value: "pcs", label: "pcs (pieces)" },
  { value: "units", label: "units" },
  { value: "bag", label: "bag" },
  { value: "box", label: "box" },
  { value: "crate", label: "crate" },
  { value: "carton", label: "carton" },
  { value: "dozen", label: "dozen" },
  { value: "tray", label: "tray" },
  { value: "bunch", label: "bunch" },
  { value: "pack", label: "pack" },
] as const;

export type InventoryUnit = (typeof INVENTORY_UNITS)[number]["value"];

export const DEFAULT_INVENTORY_UNIT: InventoryUnit = "kg";

export function isInventoryUnit(value: string): value is InventoryUnit {
  return INVENTORY_UNITS.some((u) => u.value === value);
}
