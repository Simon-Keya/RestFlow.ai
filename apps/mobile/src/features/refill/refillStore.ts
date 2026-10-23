// apps/mobile/src/features/refill/refillStore.ts
import { create } from 'zustand';
import apiClient from '../../api/apiClient';
import { useOfflineStore } from '../offline/offlineStore';

export type RefillRequestPayload = {
  item_id: string;
  item_name: string;
  units: string;
  requested_qty: number;
  notes?: string;
};

interface RefillState {
  isSubmitting: boolean;
  lastError: string | null;

  submitRefillRequest: (
    item: RefillRequestPayload,
  ) => Promise<{ success: boolean; offline?: boolean; requestId?: string; message: string }>;
}

export const useRefillStore = create<RefillState>((set) => ({
  isSubmitting: false,
  lastError: null,

  submitRefillRequest: async (item) => {
    set({ isSubmitting: true, lastError: null });

    const idempotencyKey = `refill-req-${item.item_id}-${item.requested_qty}`;

    try {
      const res = await apiClient.post('/refill/request', item, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });

      set({ isSubmitting: false });
      return {
        success: true,
        requestId: res.data?.requestId,
        message: 'Refill request submitted',
      };
    } catch (err: any) {
      const isNetworkError =
        !err.response || err.message === 'Network Error' || err.code === 'ECONNABORTED';

      if (isNetworkError) {
        await useOfflineStore.getState().addAction({
          module: 'refill',
          endpoint: '/refill/request',
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
        err.response?.data?.message || err.message || 'Failed to request refill';
      set({ isSubmitting: false, lastError: message });
      return { success: false, message };
    }
  },
}));