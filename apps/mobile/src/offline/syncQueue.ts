// apps/mobile/src/offline/syncQueue.ts
import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../features/offline/offlineStore';

let isSyncing = false;
let unsubscribe: (() => void) | null = null;

/**
 * Sync all offline-queued actions (receive, production, menu, etc.)
 * via the shared offline store / QueueManager.
 */
export const syncAllPending = async (): Promise<void> => {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const count = useOfflineStore.getState().queue.length;
    if (count === 0) return;

    console.log(`Syncing ${count} offline action(s)...`);
    await useOfflineStore.getState().syncNow();
  } catch (err) {
    console.error('Sync queue error:', err);
  } finally {
    isSyncing = false;
  }
};

/**
 * Listen for connectivity and auto-sync.
 * Returns unsubscribe — call on app unmount / logout if needed.
 */
export const initSyncQueue = (): (() => void) => {
  if (unsubscribe) {
    unsubscribe();
  }

  unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable && !isSyncing) {
      void syncAllPending();
    }
  });

  void syncAllPending();

  return () => {
    unsubscribe?.();
    unsubscribe = null;
  };
};

/** Call on app start or after login */
export const initializeOfflineSync = (): (() => void) => {
  return initSyncQueue();
};