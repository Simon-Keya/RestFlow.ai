// apps/mobile/src/features/offline/offlineStore.ts
import { create } from 'zustand';
import { QueueManager, PendingAction } from '../../lib/offline/queueManager';
import { SyncService, SyncResult } from './syncService';

interface OfflineState {
  queue: PendingAction[];
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;

  loadQueue: () => Promise<void>;
  addAction: (
    action: Omit<PendingAction, 'id' | 'createdAt' | 'retries'>,
  ) => Promise<PendingAction>;
  syncNow: () => Promise<SyncResult>;
  clearQueue: () => Promise<void>;
  getPendingCount: () => number;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  queue: [],
  isSyncing: false,
  lastSyncResult: null,

  loadQueue: async () => {
    const queue = await QueueManager.getQueue();
    set({ queue });
  },

  addAction: async (action) => {
    const created = await QueueManager.addToQueue(action);
    const queue = await QueueManager.getQueue();
    set({ queue });
    return created;
  },

  syncNow: async () => {
    if (get().isSyncing) {
      return get().lastSyncResult || { success: 0, failed: 0, remaining: 0 };
    }

    set({ isSyncing: true });

    try {
      const result = await SyncService.syncAll();
      const queue = await QueueManager.getQueue();
      set({ queue, lastSyncResult: result, isSyncing: false });
      return result;
    } catch {
      set({ isSyncing: false });
      return { success: 0, failed: 0, remaining: get().queue.length };
    }
  },

  clearQueue: async () => {
    await QueueManager.clearQueue();
    set({ queue: [], lastSyncResult: null });
  },

  getPendingCount: () => get().queue.length,
}));