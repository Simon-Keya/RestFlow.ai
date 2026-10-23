// apps/api/src/modules/sync/sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventStoreService } from '../../core/event-store.service';

export type SyncAction = {
  module: string;
  endpoint: string;
  method: string;
  payload: Record<string, unknown>;
  /** Stable client-generated id for this queued action */
  client_id: string;
  /** Optional client-derived key (preferred when present) */
  idempotency_key?: string;
};

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly eventStore: EventStoreService) {}

  /**
   * Acknowledge bulk offline uploads.
   *
   * Note: Primary offline path on mobile posts to domain endpoints
   * (/received, /pos/order, etc.). This bulk endpoint records a
   * non-projection audit event per action so retries stay idempotent.
   * It does NOT invent stock movements (those belong to domain services).
   */
  async bulkSync(actions: SyncAction[], actorUserId: string) {
    const results: Array<{
      client_id: string;
      success: boolean;
      eventId?: string;
      error?: string;
    }> = [];

    for (const action of actions) {
      try {
        // Unique per action — never only module+client
        const idempotencyKey =
          action.idempotency_key ||
          `sync-${action.module}-${action.client_id}`;

        const event = await this.eventStore.appendEvent({
          event_type: 'client_sync_ack',
          actor_user_id: actorUserId,
          idempotency_key: idempotencyKey,
          item_id:
            typeof action.payload?.item_id === 'string'
              ? action.payload.item_id
              : undefined,
          payload: {
            module: action.module,
            endpoint: action.endpoint,
            method: action.method,
            client_id: action.client_id,
            body: action.payload,
            synced_at: new Date().toISOString(),
          },
        });

        results.push({
          client_id: action.client_id,
          success: true,
          eventId: event.id,
        });
      } catch (error: any) {
        this.logger.warn(
          `Bulk sync item failed (${action.client_id}): ${error?.message}`,
        );
        results.push({
          client_id: action.client_id,
          success: false,
          error: error?.message || 'Sync failed',
        });
      }
    }

    return {
      success: true,
      processed: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }
}