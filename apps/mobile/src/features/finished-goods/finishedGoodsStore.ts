// apps/mobile/src/features/finished-goods/finishedGoodsStore.ts
import { create } from 'zustand';
import apiClient from '../../api/apiClient';
import { useOfflineStore } from '../offline/offlineStore';

export type FinishedGoodPayload = {
  item_id: string;
  item_name: string;
  quantity: number;
  batch_number: string;
  expiry_date: string;
  unit_cost?: number;
  total_cost?: number;
  production_id?: string;
  notes?: string;
};

export type AdjustFinishedGoodPayload = {
  item_id: string;
  item_name?: string;
  batch_number: string;
  adjustment_quantity: number;
  reason: string;
  unit_cost?: number;
  notes?: string;
};

interface FinishedGoodsState {
  isSubmitting: boolean;
  lastError: string | null;

  addFinishedGood: (
    item: FinishedGoodPayload,
  ) => Promise<{ success: boolean; offline?: boolean; message: string }>;

  adjustStock: (
    item: AdjustFinishedGoodPayload,
  ) => Promise<{ success: boolean; offline?: boolean; message: string }>;
}

export const useFinishedGoodsStore = create<FinishedGoodsState>((set) => ({
  isSubmitting: false,
  lastError: null,

  addFinishedGood: async (item) => {
    set({ isSubmitting: true, lastError: null });

    const idempotencyKey = `fg-add-${item.item_id}-${item.batch_number}`;

    try {
      await apiClient.post('/finished-goods', item, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });

      set({ isSubmitting: false });
      return {
        success: true,
        message: 'Finished goods recorded successfully',
      };
    } catch (err: any) {
      const isNetworkError =
        !err.response ||
        err.message === 'Network Error' ||
        err.code === 'ECONNABORTED';

      if (isNetworkError) {
        await useOfflineStore.getState().addAction({
          module: 'finished_goods',
          endpoint: '/finished-goods',
          method: 'POST',
          payload: item,
          idempotencyKey,
        });

        set({ isSubmitting: false });
        return {
          success: true,
          offline: true,
          message: 'Saved offline — will sync when online',
        };
      }

      const message =
        err.response?.data?.message ||
        err.message ||
        'Failed to add finished goods';
      set({ isSubmitting: false, lastError: message });
      return { success: false, message };
    }
  },

  adjustStock: async (item) => {
    set({ isSubmitting: true, lastError: null });

    const idempotencyKey = `fg-adjust-${item.item_id}-${item.batch_number}-${item.reason}-${item.adjustment_quantity}`;

    try {
      await apiClient.post('/finished-goods/adjust', item, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });

      set({ isSubmitting: false });
      return {
        success: true,
        message: 'Stock adjusted successfully',
      };
    } catch (err: any) {
      const isNetworkError =
        !err.response ||
        err.message === 'Network Error' ||
        err.code === 'ECONNABORTED';

      if (isNetworkError) {
        await useOfflineStore.getState().addAction({
          module: 'finished_goods',
          endpoint: '/finished-goods/adjust',
          method: 'POST',
          payload: item,
          idempotencyKey,
        });

        set({ isSubmitting: false });
        return {
          success: true,
          offline: true,
          message: 'Saved offline — will sync when online',
        };
      }

      const message =
        err.response?.data?.message || err.message || 'Failed to adjust stock';
      set({ isSubmitting: false, lastError: message });
      return { success: false, message };
    }
  },
}));