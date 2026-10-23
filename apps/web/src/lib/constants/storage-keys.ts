/** Centralized localStorage/cookie key names so a typo can't silently create a second key. */
export const STORAGE_KEYS = {
  authToken: "restflow.auth.token",
  authUser: "restflow.auth.user",
  sidebarCollapsed: "restflow.ui.sidebar-collapsed",
  lastShopId: "restflow.ui.last-shop-id",
  dashboardPeriod: "restflow.ui.dashboard-period",
} as const;

/** Cookie name middleware.ts reads to gate `(dashboard)` routes at the edge. */
export const AUTH_COOKIE_NAME = "restflow_token";
