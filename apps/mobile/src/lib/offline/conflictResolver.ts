// apps/mobile/src/lib/offline/conflictResolver.ts
import { PendingAction } from './queueManager';

export class ConflictResolver {
  /**
   * Simple last-write-wins strategy with basic conflict detection
   */
  static resolve(localAction: PendingAction, serverError: any): 'retry' | 'discard' | 'merge' {
    // If server says conflict (409)
    if (serverError?.response?.status === 409) {
      // For inventory-related actions → prefer server version
      if (['receive', 'refill', 'production'].includes(localAction.module)) {
        return 'discard';
      }
      return 'retry';
    }

    // Network errors → always retry
    if (!serverError?.response) {
      return 'retry';
    }

    // Other errors (400, 500) → discard after 3 retries
    if (localAction.retries >= 3) {
      return 'discard';
    }

    return 'retry';
  }
}