// apps/mobile/src/features/pos/posStore.ts
import { create } from 'zustand';
import posApiClient from '../../api/posApiClient';
import { API_ENDPOINTS } from '../../api/endpoints';
import { useOfflineStore } from '../offline/offlineStore';

export type OrderItem = {
  line_type?: 'menu_item' | 'combo';
  /** Preferred Nest/Go field */
  menu_item_id?: string;
  menu_id?: string;
  menu_name?: string;
  name?: string;
  combo_id?: string;
  quantity: number;
  unit_price?: number;
  selling_price?: number;
  notes?: string;
  combo_selections?: Array<{
    group_index: number;
    menu_item_ids: string[];
  }>;
};

export type PosOrderPayload = {
  order_id?: string;
  /** Web uses dine_in; Nest/Go also accept dine-in */
  order_type: 'dine-in' | 'takeaway' | 'delivery' | 'pickup' | 'dine_in';
  table_number?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  items: OrderItem[];
  total_amount?: number;
  tax_amount?: number;
  discount_amount?: number;
  payment_method: 'cash' | 'mpesa' | 'card' | 'split';
  payment_status?: 'paid' | 'pending' | 'unpaid';
  mpesa_reference?: string;
  notes?: string;
  client_idempotency_key?: string;
  shop_id?: string;
};

function normalizeOrderType(t: string): string {
  return String(t || 'dine_in').replace(/-/g, '_');
}

/** Map mobile cart lines → Nest/Go CreateOrder body */
function toApiItems(items: OrderItem[]) {
  return items.map((item) => {
    if (item.line_type === 'combo' || item.combo_id) {
      return {
        line_type: 'combo' as const,
        combo_id: item.combo_id,
        name: item.menu_name || item.name,
        quantity: item.quantity,
        combo_selections: item.combo_selections || [],
      };
    }
    const menuId =
      item.menu_item_id || item.menu_id || '';
    return {
      line_type: 'menu_item' as const,
      menu_item_id: menuId,
      menu_id: menuId,
      name: item.menu_name || item.name,
      quantity: item.quantity,
      // Server ignores client price for financial records; sent for display only
      unit_price: item.unit_price ?? item.selling_price ?? 0,
    };
  });
}

interface PosState {
  isSubmitting: boolean;
  lastError: string | null;

  submitOrder: (
    order: PosOrderPayload,
  ) => Promise<{
    success: boolean;
    offline?: boolean;
    orderId?: string;
    message: string;
  }>;
}

export const usePosStore = create<PosState>((set) => ({
  isSubmitting: false,
  lastError: null,

  submitOrder: async (order) => {
    set({ isSubmitting: true, lastError: null });

    const orderId =
      order.order_id || `ORD-local-${Date.now().toString(36)}`;
    const idempotencyKey =
      order.client_idempotency_key || `pos-order-${orderId}`;

    const payload = {
      order_id: orderId,
      order_type: normalizeOrderType(order.order_type),
      table_number: order.table_number,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      delivery_address: order.delivery_address,
      items: toApiItems(order.items),
      total_amount: order.total_amount,
      tax_amount: order.tax_amount ?? 0,
      discount_amount: order.discount_amount ?? 0,
      payment_method: order.payment_method || 'cash',
      payment_status: order.payment_status || 'paid',
      mpesa_reference: order.mpesa_reference,
      notes: order.notes,
      client_idempotency_key: idempotencyKey,
      shop_id: order.shop_id,
    };

    try {
      const res = await posApiClient.post(
        API_ENDPOINTS.POS_CREATE_ORDER,
        payload,
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
            'X-Idempotency-Key': idempotencyKey,
          },
        },
      );

      set({ isSubmitting: false });
      return {
        success: true,
        orderId:
          res.data?.orderId ||
          res.data?.order_id ||
          orderId,
        message: res.data?.message || 'Order placed successfully',
      };
    } catch (err: any) {
      const isNetworkError =
        !err.response ||
        err.message === 'Network Error' ||
        err.code === 'ECONNABORTED';

      if (isNetworkError) {
        await useOfflineStore.getState().addAction({
          module: 'pos',
          endpoint: API_ENDPOINTS.POS_CREATE_ORDER,
          method: 'POST',
          payload,
          idempotencyKey,
        });

        set({ isSubmitting: false });
        return {
          success: true,
          offline: true,
          orderId,
          message: 'Order saved offline — will sync when online',
        };
      }

      const raw = err.response?.data?.message || err.message;
      const message = Array.isArray(raw)
        ? raw.join(', ')
        : raw || 'Failed to place order';
      set({ isSubmitting: false, lastError: message });
      return { success: false, message };
    }
  },
}));
