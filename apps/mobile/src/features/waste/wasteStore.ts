// apps/mobile/src/features/waste/wasteStore.ts
import { create } from 'zustand';
import apiClient from '../../api/apiClient';
import { useOfflineStore } from '../offline/offlineStore';

export type RecordWastePayload = {
  module_source:
    | 'received'
    | 'production'
    | 'finished_goods'
    | 'refill'
    | 'pos'
    | 'manual';
  item_id: string;
  item_name: string;
  batch_number?: string;
  quantity_wasted: number;
  unit_of_measure: string;
  unit_cost: number;
  total_waste_value: number;
  waste_type:
    | 'spoilage'
    | 'damage'
    | 'theft'
    | 'shrinkage'
    | 'quality_reject'
    | 'production_reject'
    | 'other';
  waste_reason: string;
  root_cause?: 'preventable' | 'external' | 'unknown';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  photos?: string[];
  notes?: string;
};

interface WasteState {
  isSubmitting: boolean;
  lastError: string | null;

  recordWaste: (
    payload: RecordWastePayload,
  ) => Promise<{
    success: boolean;
    offline?: boolean;
    wasteId?: string;
    message: string;
  }>;
}

export const useWasteStore = create<WasteState>((set) => ({
  isSubmitting: false,
  lastError: null,

  recordWaste: async (payload) => {
    set({ isSubmitting: true, lastError: null });

    const idempotencyKey = `waste-${payload.module_source}-${payload.item_id}-${payload.quantity_wasted}-${payload.waste_reason}`;

    try {
      const res = await apiClient.post('/waste', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });

      set({ isSubmitting: false });
      return {
        success: true,
        wasteId: res.data?.wasteId,
        message: 'Waste recorded successfully',
      };
    } catch (err: any) {
      const isNetworkError =
        !err.response ||
        err.message === 'Network Error' ||
        err.code === 'ECONNABORTED';

      if (isNetworkError) {
        await useOfflineStore.getState().addAction({
          module: 'waste',
          endpoint: '/waste',
          method: 'POST',
          payload,
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
        err.response?.data?.message || err.message || 'Failed to record waste';
      set({ isSubmitting: false, lastError: message });
      return { success: false, message };
    }
  },
}));