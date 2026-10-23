// apps/mobile/src/api/types.ts
// Shared TypeScript types for API requests, responses, and app state
// Updated to match "THE RAOS V1.xlsx" structure (March 2026)

// ──────────────────────────────────────────────
// Generic API Response Wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ──────────────────────────────────────────────
// Auth / User
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'MANAGER' | 'KITCHEN' | 'POS';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role?: 'MANAGER' | 'KITCHEN' | 'POS';
}

export type RegisterResponse = LoginResponse;

// ──────────────────────────────────────────────
// Receive Goods (GRN) – matches "Received" sheet
export interface ReceiveGoodsRequest {
  item_id: string;
  item_name: string;
  units: string;                    // KG, L, pcs, bags, pieces...
  quantity: number;
  quantity_approved?: number;
  quantity_rejected?: number;
  date_received: string;            // YYYY-MM-DD
  expiry_date: string;              // YYYY-MM-DD
  unit_cost: number;
  total_cost?: number;              // usually qty × unit_cost
  supplier_name?: string;
  supplier_number?: string;
  supplier_id?: string;
  approved_by?: string;
  batch_number?: string;
  payload?: Record<string, any>;    // notes, photos, extra fields
}

export interface ReceiveGoodsResponse {
  success: boolean;
  eventId: string;
  message: string;
}

// ──────────────────────────────────────────────
// Inventory / Stock – matches "Inventory" + "Store Dashboard" sheets
export interface StockItem {
  id: string;                       // item_id
  name: string;
  unit: string;                     // KG, L, pcs...
  available_stock: number;
  expired_stock?: number;
  damaged_stock?: number;
  total_value: number;
  days_to_expiry_min: number | null;
  closest_expiry_date?: string | null; // from Closest_to_Expiry
  supplier_name?: string;
  supplier_number?: string;
  request_id?: string;              // from Refill / last receive
}

export interface StockResponse {
  items: StockItem[];
  total_items: number;
  total_value?: number;             // sum of total_value
}

// ──────────────────────────────────────────────
// Refill / Dispatch – matches "Refill" sheet
export interface RefillRequest {
  request_id: string;
  date: string;                     // YYYY-MM-DD
  item_id: string;
  qty_requested: number;
  qty_dispatched: number;
  remaining_qty: number;
  lost_weight?: number;
}

export interface RefillResponse {
  success: boolean;
  refillId: string;
  message: string;
}

// ──────────────────────────────────────────────
// Production – matches "prod" sheet
export interface ProductionRequest {
  item_no: string;
  item_name: string;
  quantity_issued: number;
  final_processed_qty: number;
  product_made: string;
  quantity_pro: number;
  time_of_prod: string;             // e.g. "0.4375" hours
  wasted_quantity?: number;
  remainder?: number;
  served_quantity?: number;
}

export interface ProductionResponse {
  success: boolean;
  productionId: string;
  message: string;
}

// ──────────────────────────────────────────────
// POS / Sales – matches "POS" sheet
export interface SaleRequest {
  order_id: string;
  menu_item: string;
  order_type: 'delivery' | 'takeaway' | 'dine-in';
  order_received_time: string;
  prep_start_time?: string;
  prep_end_time?: string;
  served_time?: string;
  staff_on_prep?: string;
}

export interface SaleResponse {
  success: boolean;
  orderId: string;
  message: string;
}

// ──────────────────────────────────────────────
// Menu Consumption – matches "Menu consumption" sheet
export interface MenuConsumption {
  menu_item: string;
  sold: number;
  dough?: number;
  cheese?: number;
  tomatoe_sauce?: number;
  sauce?: number;
  buns?: number;
  patties?: number;
  lettuce?: number;
  chicken_pieces?: number;
  fries?: number;
}

// ──────────────────────────────────────────────
// Utility / Misc
export interface SyncQueueItem<T> {
  id: string;
  data: T;
  queuedAt: string;
  attempts?: number;
  lastAttempt?: string;
}