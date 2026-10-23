// apps/web/src/types/pos.ts

export type KitchenOrderStatus =
  | "not_sent"
  | "pending"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed";

export type PaymentMethod = "cash" | "mpesa" | "card" | "split";

export interface PaymentSplit {
  method: "cash" | "mpesa" | "card";
  amount: number;
  reference?: string;
}

export interface PosOrderSummary {
  orderId: string;
  /** Kitchen / fulfillment status (may be not_sent until Send to kitchen) */
  status: KitchenOrderStatus | string;
  kitchenStatus?: KitchenOrderStatus | string;
  sentToKitchen?: boolean;
  orderType: "dine_in" | "takeaway" | "delivery" | "pickup" | string;
  totalAmount: number;
  itemCount: number;
  paymentStatus: PaymentStatus | string;
  paymentMethod?: PaymentMethod | string;
  paymentSplits?: PaymentSplit[] | null;
  createdAt: string;
  tableNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
}

export interface PosOrderLineSelection {
  componentKey: string;
  finishedGoodId: string;
  finishedGoodName?: string | null;
  quantity: number;
}

export interface PosOrderComboPick {
  groupIndex: number;
  groupName?: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
}

export interface PosOrderDetail extends PosOrderSummary {
  items: {
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineType?: string;
    comboId?: string;
    selections?: PosOrderLineSelection[];
    /** Combo category picks for order / kitchen tickets */
    comboSelections?: PosOrderComboPick[];
    stockDeductions?: Array<{
      item_id: string;
      item_name?: string;
      quantity: number;
    }>;
  }[];
  tableNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  events: OrderLifecycleEvent[];
}

export interface OrderLifecycleEvent {
  status: string;
  actor?: string | null;
  timestamp: string;
}

export interface MenuAvailability {
  menuItemId: string;
  menuCode: string;
  name: string;
  isAvailable: boolean;
  isLow: boolean;
  maxPortions: number;
  availableQuantity?: number;
  finishedGoodId?: string | null;
}