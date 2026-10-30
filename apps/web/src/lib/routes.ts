// apps/web/src/lib/routes.ts
/**
 * Centralized route builders. Nothing in `src/features` or `src/app` should hand-build a
 * `/shop/...` path string — go through these so a route shape only ever changes in one place.
 */
export const routes = {
  login: () => "/login",

  shop: (shopId: string) => `/shop/${shopId}`,
  dashboard: (shopId: string) => `/shop/${shopId}/dashboard`,

  inventory: (shopId: string) => `/shop/${shopId}/dashboard/inventory`,

  kitchen: (shopId: string) => `/shop/${shopId}/dashboard/kitchen`,
  /** Kitchen availability card deep-link (optional). Prefer routes.recipeDetail for CRUD. */
  kitchenRecipe: (shopId: string, recipeId: string) =>
    `/shop/${shopId}/dashboard/kitchen/recipe/${recipeId}`,
  closingStock: (shopId: string) =>
    `/shop/${shopId}/dashboard/kitchen/closing-stock`,

  recipes: (shopId: string) => `/shop/${shopId}/dashboard/recipes`,
  recipeNew: (shopId: string) => `/shop/${shopId}/dashboard/recipes/new`,
  recipe: (shopId: string, recipeId: string) =>
    `/shop/${shopId}/dashboard/recipes/${recipeId}`,
  recipeDetail: (shopId: string, recipeId: string) =>
    `/shop/${shopId}/dashboard/recipes/${recipeId}`,
  finishedGoods: (shopId: string) => 
    `/shop/${shopId}/dashboard/finished-goods`,
  /** Ready meals / sellable items linked to finished goods */
  menu: (shopId: string) => `/shop/${shopId}/dashboard/menu`,

  pos: (shopId: string) => `/shop/${shopId}/dashboard/pos`,
  order: (shopId: string, orderId: string) =>
    `/shop/${shopId}/dashboard/pos/order/${orderId}`,

  waste: (shopId: string) => `/shop/${shopId}/dashboard/waste`,
  wasteEvent: (shopId: string, eventId: string) =>
    `/shop/${shopId}/dashboard/waste/event/${eventId}`,

  consumption: (shopId: string) => `/shop/${shopId}/dashboard/consumption`,
  consumptionProduct: (shopId: string, productId: string) =>
    `/shop/${shopId}/dashboard/consumption/product/${productId}`,
  consumptionMenuItem: (shopId: string, menuItemId: string) =>
    `/shop/${shopId}/dashboard/consumption/menu-item/${menuItemId}`,
  consumptionAlerts: (shopId: string) =>
    `/shop/${shopId}/dashboard/consumption/alerts`,

  variance: (shopId: string) => `/shop/${shopId}/dashboard/variance`,
  varianceBatch: (shopId: string, batchId: string) =>
    `/shop/${shopId}/dashboard/variance/batch/${batchId}`,
  stockLedger: (shopId: string, date?: string) =>
    date
      ? `/shop/${shopId}/dashboard/variance/stock-ledger?date=${date}`
      : `/shop/${shopId}/dashboard/variance/stock-ledger`,

  approvals: (shopId: string) => `/shop/${shopId}/dashboard/approvals`,
  team: (shopId: string) => `/shop/${shopId}/dashboard/team`,

  trace: (shopId: string) => `/shop/${shopId}/dashboard/trace`,

  assistant: (shopId: string) => `/shop/${shopId}/dashboard/assistant`,

  traceSearch: (
    shopId: string,
    params?: { itemId?: string; batchNumber?: string; eventType?: string },
  ) => {
    const base = `/shop/${shopId}/dashboard/trace`;
    if (!params) return base;
    const qs = new URLSearchParams();
    if (params.itemId) qs.set("itemId", params.itemId);
    if (params.batchNumber) qs.set("batchNumber", params.batchNumber);
    if (params.eventType) qs.set("eventType", params.eventType);
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  },
} as const;
