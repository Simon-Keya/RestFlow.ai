export interface ShopSummary {
  shopId: string;
  shopName: string;
  todayRevenue: number;
  todayOrders: number;
  averageOrderValue?: number;
  periodFrom?: string;
  periodTo?: string;
  periodLabel?: string;
  openApprovals: number;
  lowStockCount: number;
  nearExpiryCount: number;
  finishedGoodsValue?: number;
  costMissingCount?: number;
}

export interface DashboardKpis {
  foodCostPercent: number | null;
  grossMarginPercent: number | null;
  inventoryTurnover: number | null;
  wasteValue: number;
  inventoryAccuracyPercent: number | null;
  periodRevenue: number;
  periodCogs: number;
  finishedGoodsValue?: number;
  rawInventoryValue?: number;
}

export interface DashboardAlert {
  id: string;
  type: "low_stock" | "near_expiry" | "variance" | "approval";
  severity: "info" | "warning" | "critical";
  message: string;
  href?: string;
  createdAt: string;
}
