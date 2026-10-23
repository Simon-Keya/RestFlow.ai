// apps/mobile/src/lib/constants.ts

/**
 * Nest (system of record) — receive, recipes, production, kitchen, menu admin.
 *   EXPO_PUBLIC_API_URL=https://nest-api.example.com
 *
 * Optional Go POS API (strangler). When set, POS order/bootstrap hit Go.
 *   EXPO_PUBLIC_POS_API_URL=https://go-api.example.com
 *   EXPO_PUBLIC_USE_GO_POS=true
 * No trailing slash.
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

export const POS_API_BASE_URL = (
  process.env.EXPO_PUBLIC_POS_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

export const USE_GO_POS =
  String(process.env.EXPO_PUBLIC_USE_GO_POS || '').toLowerCase() === 'true' ||
  Boolean(process.env.EXPO_PUBLIC_POS_API_URL);

export const STORAGE_KEYS = {
  PENDING_RECEIVES: 'restflow_pending_receives',
  AUTH_TOKEN: 'restflow_auth_token',
  USER_DATA: 'restflow_user_data',
  OFFLINE_QUEUE: 'restflow_offline_queue',
} as const;

export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  API: 'yyyy-MM-dd',
  FULL: 'yyyy-MM-dd HH:mm:ss',
} as const;

export const ROLES = {
  MANAGER: 'MANAGER',
  KITCHEN: 'KITCHEN',
  POS: 'POS',
  ADMIN: 'ADMIN',
} as const;

export const SOCKET_NAMESPACES = {
  POS: '/pos',
  WASTE: '/waste',
  INVENTORY: '/inventory',
  PRODUCTION: '/production',
  MENU: '/menu',
  REFILL: '/refill',
  NOTIFICATIONS: '/notifications',
  PAYMENT: '/payment',
  FINISHED_GOODS: '/finished-goods',
} as const;

export const SCREEN_NAMES = {
  LOGIN: 'Login',
  REGISTER: 'Register',
  STOCK_OVERVIEW: 'StockOverview',
  RECEIVE: 'Receive',
  POS_ORDER: 'PosOrder',
  BARCODE_SCANNER: 'BarcodeScanner',
  NOTIFICATIONS: 'NotificationSettings',
} as const;
