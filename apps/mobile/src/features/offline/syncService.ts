// apps/mobile/src/features/offline/syncService.ts
import apiClient from '../../api/apiClient';
import { QueueManager, PendingAction } from '../../lib/offline/queueManager';

export type SyncResult = {
  success: number;
  failed: number;
  remaining: number;
};

export class SyncService {
  /**
   * Sync all pending actions one-by-one.
   * Successful items are removed; failed items get a retry increment.
   */
  static async syncAll(): Promise<SyncResult> {
    const queue = await QueueManager.getQueue();

    if (queue.length === 0) {
      return { success: 0, failed: 0, remaining: 0 };
    }

    let success = 0;
    let failed = 0;

    // Process sequentially to avoid overwhelming the server
    for (const action of queue) {
      const ok = await this.syncOne(action);
      if (ok) success += 1;
      else failed += 1;
    }

    const remaining = await QueueManager.getPendingCount();

    return { success, failed, remaining };
  }

  static async syncOne(action: PendingAction): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};

      if (action.idempotencyKey) {
        headers['Idempotency-Key'] = action.idempotencyKey;
      }

      await apiClient.request({
        url: action.endpoint,
        method: action.method,
        data: action.payload,
        headers,
      });

      await QueueManager.removeFromQueue(action.id);
      console.log(`✅ Synced offline action: ${action.module} ${action.id}`);
      return true;
    } catch (error: any) {
      const message =
        error?.response?.data?.message || error?.message || 'Sync failed';

      // 409 Conflict with same payload = already processed → treat as success
      if (error?.response?.status === 409) {
        await QueueManager.removeFromQueue(action.id);
        console.log(`♻️ Idempotent conflict treated as success: ${action.id}`);
        return true;
      }

      await QueueManager.incrementRetry(action.id, message);
      console.warn(`❌ Failed offline action ${action.id}:`, message);
      return false;
    }
  }
}