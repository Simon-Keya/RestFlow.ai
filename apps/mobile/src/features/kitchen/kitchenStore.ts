// apps/mobile/src/features/kitchen/kitchenStore.ts
import { create } from 'zustand';
import { KitchenOrder, OrderStatus } from '../../types/kitchen';

interface KitchenState {
  orders: KitchenOrder[];
  selectedOrder: KitchenOrder | null;

  addOrder: (order: KitchenOrder) => void;
  updateOrderStatus: (order_id: string, status: OrderStatus) => void;
  setSelectedOrder: (order: KitchenOrder | null) => void;
  clearCompleted: () => void;
  getActiveOrders: () => KitchenOrder[];
}

export const useKitchenStore = create<KitchenState>((set, get) => ({
  orders: [],
  selectedOrder: null,

  addOrder: (order) =>
    set((state) => ({
      orders: [order, ...state.orders.filter((o) => o.order_id !== order.order_id)],
    })),

  updateOrderStatus: (order_id, status) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.order_id === order_id
          ? {
              ...o,
              status,
              started_at: status === 'preparing' && !o.started_at
                ? new Date().toISOString()
                : o.started_at,
              completed_at: status === 'ready' || status === 'completed'
                ? new Date().toISOString()
                : o.completed_at,
            }
          : o
      ),
    })),

  setSelectedOrder: (order) => set({ selectedOrder: order }),

  clearCompleted: () =>
    set((state) => ({
      orders: state.orders.filter((o) => o.status !== 'ready' && o.status !== 'completed'),
    })),

  getActiveOrders: () => get().orders.filter((o) => o.status === 'pending' || o.status === 'preparing'),
}));