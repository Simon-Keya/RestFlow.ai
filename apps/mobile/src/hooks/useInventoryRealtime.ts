// apps/mobile/src/hooks/useInventoryRealtime.ts
import { useEffect } from 'react';
import { useInventoryStore } from '../features/inventory/inventoryStore';
import { useAuthStore } from '../features/auth/authStore';
import { getSocket } from '../lib/socket';

type StockUpdatePayload = {
  item_id: string;
  available_stock: number;
  item_name?: string;
  total_value?: number;
  days_to_expiry_min?: number | null;
  shop_id?: string;
};

type LowStockAlertPayload = {
  item_id: string;
  item_name: string;
  current_stock: number;
  message: string;
};

export const useInventoryRealtime = (shopId: string = '1') => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const fetchStock = useInventoryStore((s) => s.fetchStock);
  const patchStock = useInventoryStore(
    (s) => (s as { patchStockItem?: Function }).patchStockItem,
  );

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socket = getSocket('/inventory');

    const onConnect = () => {
      socket.emit('join_shop', { shopId });
    };

    const handleStockUpdate = (data: StockUpdatePayload) => {
      if (!data?.item_id) return;

      if (typeof patchStock === 'function') {
        patchStock({
          id: data.item_id,
          available_stock: data.available_stock,
          total_value: data.total_value,
          days_to_expiry_min: data.days_to_expiry_min ?? null,
          name: data.item_name,
        });
      } else {
        // Fallback: full refresh (correct, slightly heavier)
        void fetchStock();
      }
    };

    const handleLowStockAlert = (alert: LowStockAlertPayload) => {
      console.warn('Low stock:', alert.message);
    };

    socket.on('connect', onConnect);
    socket.on('stock_updated', handleStockUpdate);
    socket.on('inventory_updated', handleStockUpdate);
    socket.on('low_stock_alert', handleLowStockAlert);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('stock_updated', handleStockUpdate);
      socket.off('inventory_updated', handleStockUpdate);
      socket.off('low_stock_alert', handleLowStockAlert);
    };
  }, [isAuthenticated, token, shopId, fetchStock, patchStock]);
};