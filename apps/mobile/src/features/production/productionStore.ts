// apps/mobile/src/features/production/productionStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import apiClient from '../../api/apiClient';
import { useOfflineStore } from '../offline/offlineStore';

export type ProductionItem = {
  production_id?: string;
  item_id: string;
  item_name: string;
  planned_quantity: number;
  actual_quantity_produced?: number;
  waste_quantity?: number;
  waste_reason?: string;
  batch_number?: string;
  notes?: string;
  status: 'in_progress' | 'completed' | 'pending_sync';
  queuedAt: string;
};

type StartProductionInput = {
  item_id: string;
  item_name: string;
  planned_quantity: number;
  notes?: string;
};

type StartResult = {
  success: boolean;
  offline?: boolean;
  message: string;
  productionId?: string;
};

export type FinishProductionInput = {
  production_id: string;
  item_id?: string;
  item_name?: string;
  planned_quantity?: number;
  actual_quantity_produced: number;
  waste_quantity?: number;
  waste_reason?: string;
  batch_number?: string;
  expiry_date?: string;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
  inputs?: Array<Record<string, unknown>>;
  outputs?: Array<Record<string, unknown>>;
};

interface ProductionState {
  pendingProductions: ProductionItem[];
  history: ProductionItem[];
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncError: string | null;
  isSubmitting: boolean;

  addProduction: (item: Omit<ProductionItem, 'queuedAt' | 'status'>) => void;
  startProduction: (input: StartProductionInput) => Promise<StartResult>;
  /** Nest finish body — production_id required (snake_case) */
  finishProduction: (input: FinishProductionInput) => Promise<StartResult>;
  removeProduction: (id: string) => void;
  syncPending: () => Promise<void>;
  retryFailedSync: () => Promise<void>;
  clearSynced: () => void;
  getPendingCount: () => number;
  fetchHistory: () => Promise<void>;
}

export const useProductionStore = create<ProductionState>()(
  persist(
    (set, get) => ({
      pendingProductions: [],
      history: [],
      syncStatus: 'idle',
      syncError: null,
      isSubmitting: false,

      addProduction: (item) => {
        const newItem: ProductionItem = {
          ...item,
          status: 'pending_sync',
          queuedAt: new Date().toISOString(),
          production_id:
            item.production_id ||
            `local-${item.item_id}-${Date.now().toString(36)}`,
        };
        set((state) => ({
          pendingProductions: [...state.pendingProductions, newItem],
          syncStatus: 'idle',
          syncError: null,
        }));
      },

      startProduction: async (input) => {
        set({ isSubmitting: true });
        const productionId = `PROD-${input.item_id}-${Date.now().toString(36)}`;

        try {
          const res = await apiClient.post('/production/start', {
            item_id: input.item_id,
            item_name: input.item_name,
            planned_quantity: input.planned_quantity,
            notes: input.notes,
          });

          set({ isSubmitting: false });
          return {
            success: true,
            offline: false,
            message: res.data?.message || 'Production started',
            productionId: res.data?.productionId || productionId,
          };
        } catch (err: unknown) {
          // Queue offline
          get().addProduction({
            production_id: productionId,
            item_id: input.item_id,
            item_name: input.item_name,
            planned_quantity: input.planned_quantity,
            notes: input.notes,
          });

          try {
            await useOfflineStore.getState().addAction({
              module: 'production',
              endpoint: '/production/start',
              method: 'POST',
              payload: {
                item_id: input.item_id,
                item_name: input.item_name,
                planned_quantity: input.planned_quantity,
                notes: input.notes,
              },
              idempotencyKey: `start-production-${productionId}`,
            });
          } catch {
            // offline store optional
          }

          set({ isSubmitting: false });
          return {
            success: true,
            offline: true,
            message: 'Saved offline — will sync when online',
            productionId,
          };
        }
      },


      finishProduction: async (input) => {
        set({ isSubmitting: true });
        const productionId = input.production_id;
        if (!productionId) {
          set({ isSubmitting: false });
          return { success: false, message: 'production_id required' };
        }
        const today = new Date().toISOString().slice(0, 10);
        const body = {
          production_id: productionId,
          productionId: productionId,
          item_id: input.item_id,
          item_name: input.item_name,
          planned_quantity: input.planned_quantity,
          actual_quantity_produced: input.actual_quantity_produced,
          waste_quantity: input.waste_quantity ?? 0,
          waste_reason: input.waste_reason,
          batch_number: input.batch_number || `AUTO-${productionId.slice(-8)}`,
          expiry_date: input.expiry_date || today,
          unit_cost: input.unit_cost,
          total_cost: input.total_cost,
          notes: input.notes,
          inputs: input.inputs,
          outputs: input.outputs,
        };
        try {
          const res = await apiClient.post('/production/finish', body, {
            headers: {
              'Idempotency-Key': `prod-finish-${productionId}`,
            },
          });
          set({ isSubmitting: false });
          return {
            success: true,
            productionId,
            message:
              res.data?.message || 'Production finished successfully',
          };
        } catch (err: any) {
          const isNetwork =
            !err.response ||
            err.message === 'Network Error' ||
            err.code === 'ECONNABORTED';
          if (isNetwork) {
            try {
              await useOfflineStore.getState().addAction({
                module: 'production',
                endpoint: '/production/finish',
                method: 'POST',
                payload: body,
                idempotencyKey: `prod-finish-${productionId}`,
              });
            } catch {
              /* optional */
            }
            set({ isSubmitting: false });
            return {
              success: true,
              offline: true,
              productionId,
              message: 'Finish saved offline — will sync when online',
            };
          }
          const raw = err.response?.data?.message || err.message;
          const message = Array.isArray(raw)
            ? raw.join(', ')
            : raw || 'Finish failed';
          set({ isSubmitting: false });
          return { success: false, message };
        }
      },

      removeProduction: (id) => {
        set((state) => ({
          pendingProductions: state.pendingProductions.filter(
            (p) => p.production_id !== id && p.batch_number !== id,
          ),
        }));
      },

      syncPending: async () => {
        const pending = get().pendingProductions;
        if (pending.length === 0) return;

        set({ syncStatus: 'syncing', syncError: null });
        let successCount = 0;
        const failed: ProductionItem[] = [];

        for (const item of pending) {
          try {
            await apiClient.post('/production/start', {
              item_id: item.item_id,
              item_name: item.item_name,
              planned_quantity: item.planned_quantity,
              notes: item.notes,
            });
            successCount++;
          } catch {
            failed.push(item);
          }
        }

        if (failed.length === 0) {
          set({
            pendingProductions: [],
            syncStatus: 'success',
            syncError: null,
          });
          setTimeout(() => set({ syncStatus: 'idle' }), 2500);
        } else {
          set({
            pendingProductions: failed,
            syncStatus: 'error',
            syncError: `${successCount} ok, ${failed.length} failed`,
          });
        }
      },

      retryFailedSync: async () => {
        await get().syncPending();
      },

      clearSynced: () => set({ pendingProductions: [] }),

      getPendingCount: () => get().pendingProductions.length,

      fetchHistory: async () => {
        try {
          const res = await apiClient.get('/production/history');
          const items = Array.isArray(res.data)
            ? res.data
            : res.data?.items || [];
          set({ history: items });
        } catch {
          // ignore
        }
      },
    }),
    {
      name: 'restflow-pending-productions',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pendingProductions: state.pendingProductions,
      }),
    },
  ),
);