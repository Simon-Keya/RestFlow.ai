// apps/mobile/src/types/kitchen.ts
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export type OrderItem = {
  menu_id: string;
  menu_name: string;
  quantity: number;
  notes?: string;
  unit_price?: number;
};

export type KitchenOrder = {
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
};