// apps/mobile/src/screens/production/ProductionHistoryScreen.tsx
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ListRenderItem,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useRole } from '../../hooks/useRole';
import { colors, spacing, typography } from '../../lib/theme';
import {
  useProductionStore,
  type ProductionItem,
} from '../../features/production/productionStore';
import type { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const buttonShadow = Platform.select({
  web: {
    // RN Web expects CSS boxShadow — avoids "shadow*" deprecation
    boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
  } as object,
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  android: {
    elevation: 4,
  },
  default: {},
});

export default function ProductionHistoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { isKitchen, isManager } = useRole();

  const {
    pendingProductions,
    history,
    syncStatus,
    syncError,
    syncPending,
    retryFailedSync,
    getPendingCount,
    fetchHistory,
  } = useProductionStore();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([syncPending(), fetchHistory()]);
    } finally {
      setRefreshing(false);
    }
  }, [syncPending, fetchHistory]);

  const pendingCount = getPendingCount();

  const listData: ProductionItem[] = React.useMemo(() => {
    const pendingIds = new Set(
      pendingProductions.map((p) => p.production_id).filter(Boolean),
    );
    const remote = history.filter((h) => !pendingIds.has(h.production_id));
    return [...pendingProductions, ...remote];
  }, [pendingProductions, history]);

  const renderProductionItem: ListRenderItem<ProductionItem> = ({ item }) => {
    const isCompleted = item.status === 'completed';
    const isPending = item.status === 'pending_sync';
    const statusColor = isCompleted
      ? colors.success
      : isPending
        ? colors.warning
        : colors.primary;
    const statusText = isCompleted
      ? 'Completed'
      : isPending
        ? 'Pending sync'
        : 'In Progress';

    const qty = item.actual_quantity_produced ?? item.planned_quantity ?? 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.itemName}>{item.item_name}</Text>
          <Text style={[styles.status, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>

        <View style={styles.details}>
          <Text style={styles.detailText}>
            Quantity: <Text style={styles.bold}>{qty}</Text>
          </Text>
          {!!item.batch_number && (
            <Text style={styles.detailText}>
              Batch: <Text style={styles.bold}>{item.batch_number}</Text>
            </Text>
          )}
          {item.waste_quantity != null && item.waste_quantity > 0 && (
            <Text style={[styles.detailText, { color: colors.danger }]}>
              Waste: {item.waste_quantity}
              {item.waste_reason ? ` • ${item.waste_reason}` : ''}
            </Text>
          )}
          {!!item.notes && (
            <Text style={styles.notes}>Note: {item.notes}</Text>
          )}
        </View>

        <Text style={styles.date}>
          {new Date(item.queuedAt).toLocaleDateString()} •{' '}
          {new Date(item.queuedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={typography.title}>Production History</Text>

      {syncStatus !== 'idle' && (
        <View
          style={[
            styles.syncBanner,
            syncStatus === 'syncing' && styles.syncBannerSyncing,
            syncStatus === 'success' && styles.syncBannerSuccess,
            syncStatus === 'error' && styles.syncBannerError,
          ]}
        >
          <Text style={styles.syncText}>
            {syncStatus === 'syncing'
              ? `Syncing ${pendingCount} production(s)...`
              : syncStatus === 'success'
                ? 'Synced successfully'
                : syncError || 'Sync failed'}
          </Text>
          {syncStatus === 'error' && (
            <TouchableOpacity onPress={retryFailedSync}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {pendingCount > 0 && syncStatus === 'idle' && (
        <Text style={styles.pendingCount}>
          {pendingCount} pending production{pendingCount !== 1 ? 's' : ''}
        </Text>
      )}

      <FlatList
        data={listData}
        keyExtractor={(item, index) =>
          item.production_id || item.batch_number || `row-${index}`
        }
        renderItem={renderProductionItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No production records yet</Text>
            <Text style={styles.emptySubText}>
              Start a new production from the Production screen
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.actions}>
        {(isKitchen || isManager) && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Production')}
          >
            <Text style={styles.actionButtonText}>+ New Production</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.primaryDark ?? colors.primary,
              marginTop: spacing.md,
            },
          ]}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.actionButtonText}>View Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xl * 2,
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
    marginBottom: spacing.sm,
  },
  itemName: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
  },
  details: { marginBottom: spacing.sm },
  detailText: {
    ...typography.small,
    marginBottom: 2,
  },
  bold: { fontWeight: '600' },
  notes: {
    ...typography.small,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  date: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySubText: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  actionButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 30,
    alignItems: 'center',
    ...buttonShadow,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
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
  syncBannerSyncing: { backgroundColor: '#FFF3CD' },
  syncBannerSuccess: { backgroundColor: '#D4EDDA' },
  syncBannerError: { backgroundColor: '#F8D7DA' },
  syncText: { fontSize: 14, fontWeight: '500', flex: 1 },
  retryText: {
    color: colors.primary,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  pendingCount: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.md,
  },
});