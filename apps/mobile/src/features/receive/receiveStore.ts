// apps/mobile/src/features/receive/receiveStore.ts
import { create } from 'zustand';
import apiClient from '../../api/apiClient';
import { useOfflineStore } from '../offline/offlineStore';
import type { ReceiveGoodsRequest } from '../../types/api';

type ApiErrorBody = {
  message?: string | string[];
  errors?: Array<{ path?: string; message?: string }>;
};

interface ReceiveState {
  isSubmitting: boolean;
  lastError: string | null;

  submitReceive: (item: ReceiveGoodsRequest) => Promise<{
    success: boolean;
    offline?: boolean;
    message: string;
  }>;

  clearError: () => void;
}

function extractErrorMessage(err: unknown): string {
  const axiosLike = err as {
    response?: { data?: ApiErrorBody; status?: number };
    message?: string;
    code?: string;
  };

  const data = axiosLike.response?.data;

  if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors
      .map((e) => {
        const path = e.path?.trim() || 'field';
        const msg = e.message?.trim() || 'Invalid value';
        return `${path}: ${msg}`;
      })
      .join('\n');
  }

  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message;
  }

  if (Array.isArray(data?.message) && data.message.length > 0) {
    return data.message.join(', ');
  }

  return axiosLike.message || 'Failed to receive goods';
}

function isNetworkError(err: unknown): boolean {
  const axiosLike = err as {
    response?: unknown;
    message?: string;
    code?: string;
  };

  return (
    !axiosLike.response ||
    axiosLike.message === 'Network Error' ||
    axiosLike.code === 'ECONNABORTED' ||
    axiosLike.code === 'ERR_NETWORK'
  );
}

export const useReceiveStore = create<ReceiveState>((set) => ({
  isSubmitting: false,
  lastError: null,

  clearError: () => set({ lastError: null }),

  submitReceive: async (item) => {
    set({ isSubmitting: true, lastError: null });

    const idempotencyKey = `receive-${item.item_id}-${item.batch_number}-${item.date_received}`;

    try {
      const res = await apiClient.post('/received', item, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });

      const serverMessage =
        (res.data as { message?: string } | undefined)?.message ||
        'Goods received successfully';

      set({ isSubmitting: false, lastError: null });
      return {
        success: true,
        message: serverMessage,
      };
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        try {
          await useOfflineStore.getState().addAction({
            module: 'receive',
            endpoint: '/received',
            method: 'POST',
            payload: { ...item } as Record<string, unknown>,
            idempotencyKey,
          });

          set({ isSubmitting: false, lastError: null });
          return {
            success: true,
            offline: true,
            message: 'Saved offline — will sync when online',
          };
        } catch (queueErr) {
          const message =
            queueErr instanceof Error
              ? queueErr.message
              : 'Failed to save offline';
          set({ isSubmitting: false, lastError: message });
          return { success: false, message };
        }
      }

      const message = extractErrorMessage(err);
      set({ isSubmitting: false, lastError: message });
      return { success: false, message };
    }
  },
}));
