export interface ConsumptionSummary {
  totalConsumedValue: number;
  periodRevenue: number;
  /**
   * Food cost as 0–100 from the API (e.g. 32.5 means 32.5%).
   * Optional for older payloads; UI falls back to value/revenue.
   */
  foodCostPercent?: number | null;
  /** How the summary was derived (debug / analytics). */
  method?: string;
  topProducts: TopConsumedProduct[];
  topMenuItems: TopConsumedMenuItem[];
}

export interface TopConsumedProduct {
  itemId: string;
  name: string;
  unit: string;
  quantityConsumed: number;
  valueConsumed: number;
}

export interface TopConsumedMenuItem {
  menuItemId: string;
  name: string;
  unitsSold: number;
  revenue: number;
  /** 0–100 from API */
  foodCostPercent: number | null;
  foodCostValue?: number;
}

export type ConsumptionAlertType =
  | "unusual_spike"
  | "unusual_drop"
  | "negative_margin"
  | "high_food_cost";

export interface ConsumptionAlert {
  id: string;
  itemId: string;
  itemName: string;
  type: ConsumptionAlertType;
  message: string;
  createdAt: string;
}
