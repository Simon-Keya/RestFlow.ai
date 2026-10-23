// apps/mobile/src/hooks/useOfflineSync.ts
import { useCallback, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { useOfflineStore } from '../features/offline/offlineStore';

/**
 * Auto-sync the unified offline queue when the device comes online.
 * Call once near the app root (e.g. App.tsx).
 */
export const useOfflineSync = () => {
  const syncNow = useOfflineStore((s) => s.syncNow);
  const loadQueue = useOfflineStore((s) => s.loadQueue);
  const queueLength = useOfflineStore((s) => s.queue.length);
  const isSyncing = useOfflineStore((s) => s.isSyncing);

  const handleSync = useCallback(async () => {
    const count = useOfflineStore.getState().queue.length;
    if (count === 0 || useOfflineStore.getState().isSyncing) return;

    console.log(`🔄 Auto-syncing ${count} offline action(s)...`);
    await syncNow();
  }, [syncNow]);

  useEffect(() => {
    void loadQueue();
    void handleSync();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        void handleSync();
      }
    });

    return () => unsubscribe();
  }, [handleSync, loadQueue]);

  return {
    manualSync: handleSync,
    pendingCount: queueLength,
    isSyncing,
  };
};