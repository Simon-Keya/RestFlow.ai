// apps/mobile/src/api/endpoints.ts — keep in sync with apps/web/src/lib/api/endpoints.ts
export const API_ENDPOINTS = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',

  RECEIVE_GOODS: '/received',
  GET_STOCK: '/inventory',

  KITCHEN_CLOSING_STOCK: '/kitchen/closing-stock',
  KITCHEN_ACTIVE_ORDERS: '/kitchen/active-orders',
  KITCHEN_ORDER_STATUS: (orderId: string) =>
    `/kitchen/orders/${orderId}/status`,

  // POS (Nest + Go both accept these)
  POS_CREATE_ORDER: '/pos/order',
  POS_ORDERS: '/pos/orders',
  POS_BOOTSTRAP: '/pos/bootstrap',
  POS_MENU_AVAILABILITY: '/pos/menu-availability',
  POS_SEND_KITCHEN: (orderId: string) =>
    `/pos/orders/${orderId}/send-to-kitchen`,
  POS_PAYMENT: (orderId: string) => `/pos/orders/${orderId}/payment`,
  /** @deprecated use POS_CREATE_ORDER */
  CREATE_ORDER: '/pos/orders',

  MENU_LIST: '/menu',
  MENU_COMBOS: '/menu/combos',

  PRODUCTION_START: '/production/start',
  PRODUCTION_FINISH: '/production/finish',
  PRODUCTION_HISTORY: '/production/history',
  PRODUCTION_QUEUE: '/kitchen/production-queue',

  LOG_WASTE: '/waste',
  WASTE_RECORD: '/waste/record',

  GET_NOTIFICATIONS: '/notifications',
  UPDATE_NOTIFICATION_SETTINGS: '/notifications/settings',
} as const;
