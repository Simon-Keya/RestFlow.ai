/**
 * Backend paths used by the web app.
 * Keep in sync with NestJS controllers under apps/api/src/modules/*.
 */
export const endpoints = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    me: "/auth/me",
  },

  users: {
    list: "/users",
    me: "/users/me",
    byId: (id: string) => `/users/${id}`,
    changeRole: (id: string) => `/users/${id}/role`,
  },

  costing: {
    sku: (itemId: string) => `/costing/sku/${encodeURIComponent(itemId)}`,
    skuCosts: "/costing/sku-costs",
  },

  inventory: {
    list: "/inventory",
    summary: "/inventory/summary",
    item: (itemId: string) => `/inventory/${itemId}`,
    batches: (itemId: string) => `/inventory/${itemId}/batches`,
    alerts: "/inventory/alerts",
    suggest: "/inventory/suggest",
  },

  received: {
    create: "/received",
    list: "/received",
  },

  finishedGoods: {
    create: "/finished-goods",
    adjust: "/finished-goods/adjust",
  },

  kitchen: {
    activeOrders: "/kitchen/active-orders",
    updateOrderStatus: (orderId: string) =>
      `/kitchen/orders/${orderId}/status`,
    productionQueue: "/kitchen/production-queue",
    productionHistory: "/kitchen/production-history",
    closingStock: "/kitchen/closing-stock",
    closingStockLedger: "/kitchen/closing-stock/ledger",
    closingStockHistory: "/kitchen/closing-stock/history",
    closingStockAdjustments: "/kitchen/closing-stock/adjustments",
    submitClosingStock: "/kitchen/closing-stock",
    prePrep: "/kitchen/pre-prep",
  },

  production: {
    start: "/production/start",
    finish: "/production/finish",
    history: "/production/history",
    prePrep: "/production/pre-prep",
  },

  recipe: {
    list: "/recipe",
    detail: (recipeId: string) => `/recipe/${recipeId}`,
    byItem: (itemId: string) => `/recipe/item/${itemId}`,
    create: "/recipe",
    update: (recipeId: string) => `/recipe/${recipeId}`,
    addIngredient: "/recipe/ingredient",
    addOutput: (recipeId: string) => `/recipe/${recipeId}/outputs`,
  },

    pos: {
    createOrder: "/pos/order",
    orders: "/pos/orders",
    order: (orderId: string) => `/pos/orders/${orderId}`,
    bootstrap: "/pos/bootstrap",
    menuAvailability: "/pos/menu-availability",
    sendToKitchen: (orderId: string) =>
      `/pos/orders/${orderId}/send-to-kitchen`,
    updatePayment: (orderId: string) => `/pos/orders/${orderId}/payment`,
  },

  menu: {
    list: "/menu",
    create: "/menu",
    finishedGoods: "/menu/finished-goods",
    finishedGoodCategories: "/menu/finished-good-categories",
    catalogItems: "/menu/catalog-items",
    categories: "/menu/categories",
    combos: "/menu/combos",
    comboPreview: "/menu/combos/preview",
    availability: (menuId: string) => `/menu/${menuId}/availability`,
  },

  refill: {
    request: "/refill/request",
    issue: "/refill/issue",
    pending: "/refill/pending",
    detail: (requestId: string) =>
      `/refill/requests/${encodeURIComponent(requestId)}`,
  },

  waste: {
    record: "/waste/record",
    analytics: "/waste/analytics",
    events: "/waste/events",
    event: (eventId: string) => `/waste/events/${eventId}`,
    writeOffExpired: "/waste/write-off-expired",
    expiredCandidates: "/waste/expired-candidates",
  },

  consumption: {
    summary: "/consumption/summary",
    byProduct: (productId: string) => `/consumption/products/${productId}`,
    byMenuItem: (menuItemId: string) =>
      `/consumption/menu-items/${menuItemId}`,
    alerts: "/consumption/alerts",
  },

  trace: {
    search: "/trace",
    forItem: (itemId: string) => `/trace/item/${itemId}`,
  },

  dashboard: {
    summary: "/dashboard/summary",
    kpis: "/dashboard/kpis",
    alerts: "/dashboard/alerts",
  },

  payment: {
    mpesa: "/payment/mpesa",
    stripe: "/payment/stripe",
  },

  notifications: {
    list: "/notifications",
    markRead: (id: string) => `/notifications/${id}/read`,
  },

  variance: {
    batches: "/variance/batches",
    batch: (batchId: string) => `/variance/batches/${batchId}`,
    submitReasonCode: (batchId: string) =>
      `/variance/batches/${batchId}/reason`,
    flag: (batchId: string) => `/variance/batches/${batchId}/flag`,
  },

  approvals: {
    pending: "/approvals/pending",
    approve: (approvalId: string) => `/approvals/${approvalId}/approve`,
    reject: (approvalId: string) => `/approvals/${approvalId}/reject`,
  },
} as const;