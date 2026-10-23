// apps/mobile/src/features/offline/useOfflineSync.ts
import { useEffect, useRef } from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useOfflineStore } from './offlineStore';

/**
 * Call once near the root of the app (e.g. App.tsx or RootNavigator).
 * Loads the queue and auto-syncs when the device comes online.
 */
export const useOfflineSync = () => {
  const { isFullyOnline } = useNetworkStatus();
  const { syncNow, loadQueue, queue, isSyncing, lastSyncResult } =
    useOfflineStore();

  const wasOffline = useRef(false);

  // Load queue on mount
  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Auto-sync when transitioning from offline → online
  useEffect(() => {
    if (!isFullyOnline) {
      wasOffline.current = true;
      return;
    }

    if (wasOffline.current && queue.length > 0 && !isSyncing) {
      console.log('🌐 Back online → auto-syncing offline queue...');
      syncNow();
      wasOffline.current = false;
    }
  }, [isFullyOnline, queue.length, isSyncing, syncNow]);

  return {
    pendingCount: queue.length,
    isSyncing,
    lastSyncResult,
    isOnline: isFullyOnline,
    syncNow,
  };
};