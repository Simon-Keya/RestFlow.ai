// apps/web/src/features/menu/types.ts
export type ComponentType = "FIXED" | "CHOICE" | "MULTI_CHOICE" | "INVENTORY";

export interface ChoiceOption {
  finishedGoodId: string;
  finishedGoodName: string;
  unit: string;
  availableStock: number;
  unitCost: number;
  maxPortions: number;
}

export interface MenuComponentLine {
  componentKey: string;
  componentType: ComponentType;
  finishedGoodId: string | null;
  finishedGoodName: string | null;
  finishedGoodCategoryId: string | null;
  finishedGoodCategoryCode: string | null;
  finishedGoodCategoryName: string | null;
  quantityRequired: number;
  unit: string;
  minSelect: number;
  maxSelect: number;
  allowRepeat: boolean;
  availableStock: number;
  maxPortions: number;
  unitCost: number;
  lineCost: number;
  options: ChoiceOption[];
}

export interface MenuItem {
  menuId: string;
  menuCode: string;
  name: string;
  category: string | null;
  sellingPrice: number;
  taxRate: number;
  finishedGoodId: string | null;
  finishedGoodName: string | null;
  quantityRequired: number;
  unit: string;
  lines: MenuComponentLine[];
  isAvailable: boolean;
  isVisible: boolean;
  availableQuantity: number;
  maxPortions: number;
  unitCost: number;
  foodCost: number;
  margin: number;
  marginPercent: number | null;
  foodCostPercent?: number | null;
  /** True when a component has no WAC */
  costMissing?: boolean;
  requiresSelection: boolean;
  status: string;
  createdAt: string | null;
}
