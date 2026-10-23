// apps/web/src/features/kitchen/types.ts

export interface ActiveOrder {
  orderId: string;
  status: "pending" | "preparing" | "ready" | "served" | "cancelled";
  orderType: "dine_in" | "takeaway" | "delivery" | "pickup" | string;
  tableNumber?: string | null;
  items: OrderLineItem[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderLineSelection {
  groupIndex: number;
  groupName?: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
}

export interface OrderLineItem {
  menuItemId: string;
  name: string;
  quantity: number;
  notes?: string;
  lineType?: "menu_item" | "combo" | string;
  comboId?: string;
  /** Combo picks — required on kitchen & order tickets */
  selections?: OrderLineSelection[];
}

export interface RecipeIngredient {
  rawItemId: string;
  name: string;
  quantityPerUnit: number;
  unit: string;
  unitCost: number;
}

/** Multi-output size line (e.g. DOUGH-L / DOUGH-M / DOUGH-S). */
export interface RecipeOutput {
  itemId: string;
  itemName: string;
  /** Example mix only — not production truth for multi-output */
  standardQuantity: number | null;
  unit: string;
  /** Fixed weight per piece (e.g. 250) */
  unitWeight?: number | null;
  weightUnit?: string | null;
  isDefault?: boolean;
}

export interface Recipe {
  recipeId: string;
  name: string;
  /** Finished item SKU (primary / menu link) */
  menuItemId: string;
  yieldQuantity: number;
  yieldUnit: string;
  ingredients: RecipeIngredient[];
  isAvailable: boolean;
  maxPortionsFromStock: number;
  /** Present when recipe has one or more explicit outputs */
  outputs?: RecipeOutput[];
}

export interface ProductionQueueItem {
  productionId: string;
  recipeId: string;
  recipeName: string;
  batchSize: number;
  status: "started" | "finished";
  startedAt: string;
  finishedAt?: string | null;
}

/** One finished lot (keyed by productionId). */
export interface ProductionHistoryItem {
  productionId: string;
  recipeId: string;
  recipeName: string;
  itemId?: string;
  batchSize: number;
  actualYield: number | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  stockExpiry?: string | null;
  availableStock?: number | null;
  totalValue?: number | null;
  /** Finished-good WAC on hand */
  unitCost?: number | null;
  /** Unit cost from the production run */
  runUnitCost?: number | null;
  totalInputCost?: number | null;
  unit?: string;
  status: "finished";
  startedAt: string;
  finishedAt: string | null;
}

export interface ClosingStockEntry {
  itemId: string;
  name: string;
  unit: string;
  expectedQuantity: number;
  countedQuantity: number | null;
}