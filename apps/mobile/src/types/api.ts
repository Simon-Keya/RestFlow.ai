// apps/mobile/src/types/api.ts

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  eventId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'MANAGER' | 'KITCHEN' | 'POS' | 'ADMIN';
  };
}

export interface ReceiveGoodsRequest {
  item_id: string;
  item_name: string;
  units: string;
  /** Leaf ingredient category on Item.category */
  category: string;
  quantity: number;
  quantity_approved?: number;
  quantity_rejected?: number;
  date_received: string;
  expiry_date: string;
  unit_cost: number;
  total_cost?: number;
  supplier_name?: string;
  supplier_number?: string;
  supplier_id?: string;
  approved_by?: string;
  batch_number: string;
  payload?: Record<string, unknown>;
}

export interface ReceiveGoodsResponse {
  success: boolean;
  eventId: string;
  message: string;
}

export interface StockItem {
  id: string;
  name: string;
  unit: string;
  category?: string;
  available_stock: number;
  expired_stock?: number;
  damaged_stock?: number;
  total_value: number;
  days_to_expiry_min: number | null;
  closest_expiry_date?: string | null;
  next_expiry_date?: string | null;
  supplier_name?: string;
  supplier_number?: string;
  request_id?: string;
  reorder_point?: number;
  last_received_at?: string;
}

export interface StockResponse {
  items: StockItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  total_items?: number;
  total_value?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  ingredients?: Record<string, number>;
}

export interface MenuResponse {
  items: MenuItem[];
}

export interface PosOrderRequest {
  items: Array<{
    menu_item: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  total_amount: number;
  order_type: 'dine-in' | 'takeaway' | 'delivery';
  timestamp: string;
}

export interface PosOrderResponse {
  success: boolean;
  orderId?: string;
  message: string;
}

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export interface OrderItem {
  menu_id: string;
  menu_name: string;
  quantity: number;
  notes?: string;
  unit_price?: number;
}

export interface KitchenOrder {
  order_id: string;
  items: OrderItem[];
  order_type: 'dine-in' | 'takeaway' | 'delivery' | 'pickup';
  table_number?: string;
  customer_name?: string;
  customer_phone?: string;
  status: OrderStatus;
  started_at?: string;
  completed_at?: string;
  timestamp: string;
  total_amount: number;
  priority?: 'normal' | 'high';
}

export const isSuccess = <T>(
  res: ApiResponse<T>,
): res is ApiResponse<T> & { success: true } => res.success === true;
