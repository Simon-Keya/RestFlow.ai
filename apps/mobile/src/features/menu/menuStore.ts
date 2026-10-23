// apps/mobile/src/features/menu/menuStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import apiClient from '../../api/apiClient';

export type MenuItem = {
  menu_id?: string;
  menu_code: string;
  name: string;
  category?: string;
  selling_price: number;
  tax_rate?: number;
  preparation_time_minutes?: number;
  image_url?: string;
  is_available: boolean;
  is_visible: boolean;
  available_quantity?: number;
  notes?: string;
  queuedAt: string;
};

type SubmitMenuInput = Omit<MenuItem, 'queuedAt' | 'menu_id' | 'available_quantity'>;

type SubmitResult = {
  success: boolean;
  offline?: boolean;
  message: string;
};

interface MenuState {
  pendingMenus: MenuItem[];
  menuItems: MenuItem[];
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncError: string | null;
  isSubmitting: boolean;

  addMenu: (item: Omit<MenuItem, 'queuedAt'>) => void;
  submitMenu: (item: SubmitMenuInput) => Promise<SubmitResult>;
  removeMenu: (menu_code: string) => void;
  syncPending: () => Promise<void>;
  retryFailedSync: () => Promise<void>;
  clearSynced: () => void;
  getPendingCount: () => number;
  fetchMenus: () => Promise<void>;
  setMenuItems: (items: MenuItem[]) => void;
}

export const useMenuStore = create<MenuState>()(
  persist(
    (set, get) => ({
      pendingMenus: [],
      menuItems: [],
      syncStatus: 'idle',
      syncError: null,
      isSubmitting: false,

      addMenu: (item) => {
        const newItem: MenuItem = {
          ...item,
          queuedAt: new Date().toISOString(),
        };
        set((state) => ({
          pendingMenus: [...state.pendingMenus, newItem],
          syncStatus: 'idle',
          syncError: null,
        }));
      },

      submitMenu: async (item) => {
        set({ isSubmitting: true });
        try {
          await apiClient.post('/menu', {
            menu_code: item.menu_code,
            name: item.name,
            category: item.category,
            selling_price: item.selling_price,
            tax_rate: item.tax_rate,
            preparation_time_minutes: item.preparation_time_minutes,
            image_url: item.image_url,
            is_available: item.is_available,
            is_visible: item.is_visible,
            notes: item.notes,
          });
          set({ isSubmitting: false });
          await get().fetchMenus();
          return {
            success: true,
            offline: false,
            message: 'Menu item created successfully',
          };
        } catch {
          get().addMenu(item);
          set({ isSubmitting: false });
          return {
            success: true,
            offline: true,
            message: 'Saved offline — will sync when online',
          };
        }
      },

      removeMenu: (menu_code) => {
        set((state) => ({
          pendingMenus: state.pendingMenus.filter(
            (i) => i.menu_code !== menu_code,
          ),
        }));
      },

      syncPending: async () => {
        const pending = get().pendingMenus;
        if (pending.length === 0) return;

        set({ syncStatus: 'syncing', syncError: null });
        let successCount = 0;
        const failed: MenuItem[] = [];

        for (const item of pending) {
          try {
            await apiClient.post('/menu', {
              menu_code: item.menu_code,
              name: item.name,
              category: item.category,
              selling_price: item.selling_price,
              tax_rate: item.tax_rate,
              preparation_time_minutes: item.preparation_time_minutes,
              image_url: item.image_url,
              is_available: item.is_available,
              is_visible: item.is_visible,
              notes: item.notes,
            });
            successCount++;
          } catch {
            failed.push(item);
          }
        }

        if (failed.length === 0) {
          set({
            pendingMenus: [],
            syncStatus: 'success',
            syncError: null,
          });
          setTimeout(() => set({ syncStatus: 'idle' }), 2500);
          await get().fetchMenus();
        } else {
          set({
            pendingMenus: failed,
            syncStatus: 'error',
            syncError: `${successCount} ok, ${failed.length} failed`,
          });
        }
      },

      retryFailedSync: async () => {
        await get().syncPending();
      },

      clearSynced: () => set({ pendingMenus: [] }),

      getPendingCount: () => get().pendingMenus.length,

      fetchMenus: async () => {
        try {
          const res = await apiClient.get('/menu');
          const raw = Array.isArray(res.data)
            ? res.data
            : res.data?.items || res.data?.menus || [];
          // Nest/Go: menuId + sellingPrice
          const items = (raw as Array<Record<string, unknown>>).map((m) => {
            const menu_id = String(
              m.menu_id ?? m.menuId ?? m.menuItemId ?? m.id ?? '',
            );
            const selling_price = Number(
              m.selling_price ?? m.sellingPrice ?? m.price ?? 0,
            );
            return {
              ...m,
              menu_id,
              menu_code: String(m.menu_code ?? m.menuCode ?? menu_id),
              name: String(m.name ?? menu_id),
              selling_price: Number.isFinite(selling_price) ? selling_price : 0,
              is_available:
                m.is_available !== false && m.isAvailable !== false,
              is_visible: m.is_visible !== false && m.isVisible !== false,
            };
          });
          set({ menuItems: items as MenuItem[] });
        } catch {
          // keep cached
        }
      },

      setMenuItems: (items) => set({ menuItems: items }),
    }),
    {
      name: 'restflow-pending-menus',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ pendingMenus: state.pendingMenus }),
    },
  ),
);