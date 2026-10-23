// apps/mobile/src/features/recipe/recipeStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import apiClient from '../../api/apiClient';

export type RecipeItem = {
  recipe_id?: string;
  item_id: string;
  item_name: string;
  standard_yield: number;
  unit: string;
  notes?: string;
  ingredients?: any[]; // Array of ingredients
  queuedAt: string;
};

interface RecipeState {
  pendingRecipes: RecipeItem[];
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncError: string | null;

  addRecipe: (item: Omit<RecipeItem, 'queuedAt'>) => void;
  removeRecipe: (recipe_id: string) => void;
  syncPending: () => Promise<void>;
  clearSynced: () => void;
  getPendingCount: () => number;
  retryFailedSync: () => Promise<void>;
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      pendingRecipes: [],
      syncStatus: 'idle',
      syncError: null,

      addRecipe: (item) => {
        const newItem: RecipeItem = {
          ...item,
          queuedAt: new Date().toISOString(),
        };

        set((state) => ({
          pendingRecipes: [...state.pendingRecipes, newItem],
          syncStatus: 'idle',
        }));
      },

      removeRecipe: (recipe_id) => {
        set((state) => ({
          pendingRecipes: state.pendingRecipes.filter((i) => i.recipe_id !== recipe_id),
        }));
      },

      syncPending: async () => {
        const pending = get().pendingRecipes;
        if (pending.length === 0) return;

        set({ syncStatus: 'syncing', syncError: null });

        let successCount = 0;
        const failed: RecipeItem[] = [];

        for (const item of pending) {
          try {
            await apiClient.post('/recipe', item);
            successCount++;

            set((state) => ({
              pendingRecipes: state.pendingRecipes.filter((i) => i.recipe_id !== item.recipe_id),
            }));
          } catch (err: any) {
            console.error('Failed to sync recipe:', err);
            failed.push(item);
          }
        }

        if (failed.length === 0) {
          set({ syncStatus: 'success', syncError: null });
          setTimeout(() => set({ syncStatus: 'idle' }), 2500);
        } else {
          set({
            syncStatus: 'error',
            syncError: `${successCount} succeeded, ${failed.length} failed`,
            pendingRecipes: failed,
          });
        }
      },

      clearSynced: () => set({ pendingRecipes: [] }),
      getPendingCount: () => get().pendingRecipes.length,
      retryFailedSync: async () => {
        await get().syncPending();
      },
    }),
    {
      name: 'restflow-pending-recipes',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);