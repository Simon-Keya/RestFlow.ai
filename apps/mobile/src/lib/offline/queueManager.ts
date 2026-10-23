// apps/mobile/src/lib/offline/queueManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

export type OfflineModule =
  | 'receive'
  | 'refill'
  | 'production'
  | 'waste'
  | 'pos'
  | 'payment'
  | 'finished_goods'
  | 'menu';

export type PendingAction = {
  id: string;
  module: OfflineModule;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  payload: Record<string, unknown>;
  /** Client-generated stable key for server idempotency */
  idempotencyKey?: string;
  createdAt: string;
  retries: number;
  lastError?: string;
};

const QUEUE_KEY = STORAGE_KEYS.OFFLINE_QUEUE || 'restflow_offline_queue';
const DEAD_LETTER_KEY = 'restflow_offline_dead_letter';
const MAX_RETRIES = 5;

export class QueueManager {
  static async getQueue(): Promise<PendingAction[]> {
    try {
      const data = await AsyncStorage.getItem(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load offline queue', error);
      return [];
    }
  }

  static async saveQueue(queue: PendingAction[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  static async getDeadLetter(): Promise<PendingAction[]> {
    try {
      const data = await AsyncStorage.getItem(DEAD_LETTER_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static async saveDeadLetter(items: PendingAction[]): Promise<void> {
    await AsyncStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(items));
  }

  /**
   * Build a stable fingerprint for duplicate detection.
   * Prefer idempotencyKey when available.
   */
  private static fingerprint(action: {
    module: string;
    endpoint: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  }): string {
    if (action.idempotencyKey) {
      return `key:${action.idempotencyKey}`;
    }

    return JSON.stringify({
      module: action.module,
      endpoint: action.endpoint,
      payload: action.payload,
    });
  }

  static async addToQueue(
    action: Omit<PendingAction, 'id' | 'createdAt' | 'retries'>,
  ): Promise<PendingAction> {
    const queue = await this.getQueue();
    const fp = this.fingerprint(action);

    const existing = queue.find((item) => this.fingerprint(item) === fp);
    if (existing) {
      console.log('Offline action already queued — skipping duplicate');
      return existing;
    }

    const newAction: PendingAction = {
      ...action,
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      retries: 0,
    };

    queue.push(newAction);
    await this.saveQueue(queue);
    return newAction;
  }

  static async removeFromQueue(id: string): Promise<void> {
    const queue = await this.getQueue();
    await this.saveQueue(queue.filter((item) => item.id !== id));
  }

  static async updateAction(
    id: string,
    updates: Partial<PendingAction>,
  ): Promise<void> {
    const queue = await this.getQueue();
    const updated = queue.map((item) =>
      item.id === id ? { ...item, ...updates } : item,
    );
    await this.saveQueue(updated);
  }

  /**
   * Increment retry count. After MAX_RETRIES, move to dead-letter queue
   * instead of silently dropping (so failures remain inspectable).
   */
  static async incrementRetry(
    id: string,
    errorMessage?: string,
  ): Promise<boolean> {
    const queue = await this.getQueue();
    const item = queue.find((q) => q.id === id);
    if (!item) return false;

    item.retries += 1;
    item.lastError = errorMessage;

    if (item.retries >= MAX_RETRIES) {
      const remaining = queue.filter((q) => q.id !== id);
      await this.saveQueue(remaining);

      const dead = await this.getDeadLetter();
      dead.push({ ...item });
      await this.saveDeadLetter(dead);

      console.warn(
        `Moved offline action to dead-letter after ${MAX_RETRIES} retries:`,
        id,
      );
      return false;
    }

    await this.saveQueue(queue);
    return true;
  }

  static async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
  }

  static async clearDeadLetter(): Promise<void> {
    await AsyncStorage.removeItem(DEAD_LETTER_KEY);
  }

  static async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  static async getDeadLetterCount(): Promise<number> {
    const dead = await this.getDeadLetter();
    return dead.length;
  }
}