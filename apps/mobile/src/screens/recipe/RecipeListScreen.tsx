// apps/mobile/src/screens/recipe/RecipeListScreen.tsx

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  useNavigation,
  type NavigationProp,
} from '@react-navigation/native';

import type { RootStackParamList } from '../../navigation/types';

import { useRole } from '../../hooks/useRole';
import { colors, spacing, typography } from '../../lib/theme';
import { useRecipeStore } from '../../features/recipe/recipeStore';

interface Recipe {
  recipe_id?: string;
  item_name: string;
  standard_yield: number;
  unit: string;
  notes?: string;
}

export default function RecipeListScreen() {
  const navigation =
    useNavigation<NavigationProp<RootStackParamList>>();

  const { isManager } = useRole();

  const {
    pendingRecipes,
    syncStatus,
    syncError,
    syncPending,
    retryFailedSync,
    getPendingCount,
  } = useRecipeStore();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await syncPending();
    } finally {
      setRefreshing(false);
    }
  }, [syncPending]);

  const pendingCount = getPendingCount();

  const renderItem = ({ item }: { item: Recipe }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.itemName}>
          {item.item_name}
        </Text>

        <Text style={styles.yield}>
          Yield: {item.standard_yield} {item.unit}
        </Text>
      </View>

      {item.notes ? (
        <Text style={styles.notes}>
          Note: {item.notes}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={typography.title}>Recipes</Text>

      {syncStatus !== 'idle' && (
        <View
          style={[
            styles.syncBanner,
            syncStatus === 'syncing' &&
              styles.syncBannerSyncing,
            syncStatus === 'success' &&
              styles.syncBannerSuccess,
            syncStatus === 'error' &&
              styles.syncBannerError,
          ]}
        >
          <Text style={styles.syncText}>
            {syncStatus === 'syncing'
              ? `Syncing ${pendingCount} recipe(s)...`
              : syncStatus === 'success'
              ? '✅ Synced successfully!'
              : `❌ ${syncError ?? 'Sync failed'}`}
          </Text>

          {syncStatus === 'error' && (
            <TouchableOpacity
              onPress={retryFailedSync}
            >
              <Text style={styles.retryText}>
                Retry
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={pendingRecipes}
        keyExtractor={(item: Recipe, index) =>
          item.recipe_id ?? index.toString()
        }
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No recipes yet
            </Text>

            <Text style={styles.emptySubText}>
              Create your first recipe
            </Text>
          </View>
        }
      />

      {isManager && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() =>
            navigation.navigate('CreateRecipe')
          }
        >
          <Text style={styles.fabText}>
            + New Recipe
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  itemName: {
    ...typography.body,
    fontWeight: '600',
  },

  yield: {
    ...typography.small,
    color: colors.primary,
  },

  notes: {
    ...typography.small,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },

  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  emptySubText: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  fab: {
    position: 'absolute',
    bottom: spacing.xl * 1.5,
    right: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  fabText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  syncBanner: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  syncBannerSyncing: {
    backgroundColor: '#FFF3CD',
  },

  syncBannerSuccess: {
    backgroundColor: '#D4EDDA',
  },

  syncBannerError: {
    backgroundColor: '#F8D7DA',
  },

  syncText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },

  retryText: {
    color: colors.primary,
    fontWeight: '700',
  },
});