// apps/mobile/src/features/inventory/inventoryStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create, type StateCreator } from 'zustand';
import {
  createJSONStorage,
  persist,
  type PersistOptions,
} from 'zustand/middleware';
import apiClient from '../../api/apiClient';
import type { StockItem } from '../../types/api';

export const STOCK_PAGE_SIZE = 15;

interface InventoryState {
  stock: StockItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;

  fetchStock: (page?: number) => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  updateStockLocally: (itemId: string, change: number) => void;
  setStock: (items: StockItem[]) => void;
  patchStockItem: (partial: {
    id: string;
    available_stock?: number;
    total_value?: number;
    days_to_expiry_min?: number | null;
    name?: string;
    category?: string;
  }) => void;
}

type InventoryPersisted = Pick<InventoryState, 'stock'>;

function mapStockRow(raw: Record<string, unknown>): StockItem {
  return {
    id: String(raw.id ?? raw.item_id ?? raw.itemId ?? ''),
    name: String(raw.name ?? raw.item_name ?? ''),
    unit: String(raw.unit ?? 'units'),
    category: String(raw.category ?? 'General'),
    available_stock: Number(raw.available_stock ?? raw.availableStock ?? 0),
    expired_stock: Number(raw.expired_stock ?? raw.expiredStock ?? 0),
    damaged_stock: Number(raw.damaged_stock ?? raw.damagedStock ?? 0),
    total_value: Number(raw.total_value ?? raw.totalValue ?? 0),
    days_to_expiry_min:
      raw.days_to_expiry_min != null || raw.daysToExpiryMin != null
        ? Number(raw.days_to_expiry_min ?? raw.daysToExpiryMin)
        : null,
    closest_expiry_date:
      raw.closest_expiry_date != null || raw.next_expiry_date != null
        ? String(raw.closest_expiry_date ?? raw.next_expiry_date)
        : null,
    next_expiry_date:
      raw.next_expiry_date != null ? String(raw.next_expiry_date) : null,
    reorder_point: Number(raw.reorder_point ?? raw.reorderPoint ?? 10),
    last_received_at:
      raw.last_received_at != null ? String(raw.last_received_at) : undefined,
  };
}

const useInventoryStoreBase: StateCreator<InventoryState> = (set, get) => ({
  stock: [],
  page: 1,
  pageSize: STOCK_PAGE_SIZE,
  total: 0,
  totalPages: 1,
  isLoading: false,
  error: null,

  fetchStock: async (pageArg?: number) => {
    const page = Math.max(1, pageArg ?? get().page);
    const limit = get().pageSize;

    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.get('/inventory', {
        params: { page, limit },
      });
      const root = (res.data ?? {}) as Record<string, unknown>;
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(root.items)
          ? root.items
          : [];

      const items = (rows as unknown[])
        .map((r) => mapStockRow((r ?? {}) as Record<string, unknown>))
        .filter((i) => i.id);

      const total = Number(root.total ?? items.length);
      const totalPages = Math.max(
        1,
        Number(root.totalPages ?? (Math.ceil(total / limit) || 1)),
      );

      set({
        stock: items,
        page: Number(root.page ?? page),
        total,
        totalPages,
        isLoading: false,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load inventory';
      set({ error: message, isLoading: false });
    }
  },

  goToPage: async (page: number) => {
    const { totalPages, fetchStock } = get();
    const next = Math.min(Math.max(1, page), totalPages);
    await fetchStock(next);
  },

  nextPage: async () => {
    const { page, totalPages, fetchStock } = get();
    if (page < totalPages) await fetchStock(page + 1);
  },

  prevPage: async () => {
    const { page, fetchStock } = get();
    if (page > 1) await fetchStock(page - 1);
  },

  updateStockLocally: (itemId: string, change: number) => {
    set((state) => ({
      stock: state.stock.map((item) =>
        item.id === itemId
          ? {
              ...item,
              available_stock: Math.max(0, item.available_stock + change),
            }
          : item,
      ),
    }));
  },

  setStock: (items: StockItem[]) => set({ stock: items }),

  patchStockItem: (partial) =>
    set((state) => ({
      stock: state.stock.map((item) =>
        item.id === partial.id
          ? {
              ...item,
              available_stock:
                partial.available_stock ?? item.available_stock,
              total_value: partial.total_value ?? item.total_value,
              days_to_expiry_min:
                partial.days_to_expiry_min !== undefined
                  ? partial.days_to_expiry_min
                  : item.days_to_expiry_min,
              name: partial.name || item.name,
              category: partial.category ?? item.category,
            }
          : item,
      ),
    })),
});

const persistOptions: PersistOptions<InventoryState, InventoryPersisted> = {
  name: 'restflow-inventory',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state): InventoryPersisted => ({ stock: state.stock }),
};

export const useInventoryStore = create<InventoryState>()(
  persist(useInventoryStoreBase, persistOptions),
);