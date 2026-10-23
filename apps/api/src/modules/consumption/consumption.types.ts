// apps/api/src/modules/consumption/consumption.types.ts

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
  foodCostPercent: number | null;
  foodCostValue: number;
}

export interface ConsumptionSummary {
  totalConsumedValue: number;
  periodRevenue: number;
  foodCostPercent: number | null;
  topProducts: TopConsumedProduct[];
  topMenuItems: TopConsumedMenuItem[];
  method: 'recipe_x_usage';
}

export interface ConsumptionAlert {
  id: string;
  itemId: string;
  itemName: string;
  type: 'unusual_spike' | 'high_food_cost';
  message: string;
  createdAt: string;
}
