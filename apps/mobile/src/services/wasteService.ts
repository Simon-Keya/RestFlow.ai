// apps/mobile/src/services/wasteService.ts
import apiClient from '../api/apiClient';

export interface WasteLog {
  item_id: string;
  quantity: number;
  reason: 'spoilage' | 'over_issue' | 'damage' | 'other';
  notes?: string;
  photo_url?: string;
  logged_at: string;
}

export const logWaste = async (waste: Omit<WasteLog, 'logged_at'>): Promise<void> => {
  try {
    const payload = {
      ...waste,
      logged_at: new Date().toISOString(),
    };
    await apiClient.post('/waste', payload);
    console.log('Waste logged successfully');
  } catch (err) {
    console.error('Waste log failed:', err);
    throw err;
  }
};

// Future: offline queue for waste logs
export const queueWasteLog = (waste: Omit<WasteLog, 'logged_at'>) => {
  // TODO: Add to offline queue similar to receive
  console.warn('Waste queued offline (stub)');
};