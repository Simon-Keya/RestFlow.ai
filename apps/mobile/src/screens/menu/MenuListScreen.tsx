// apps/mobile/src/screens/menu/MenuListScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useRole } from '../../hooks/useRole';
import { colors, spacing, typography } from '../../lib/theme';
import { useMenuStore, type MenuItem } from '../../features/menu/menuStore';
import { getSocket } from '../../lib/socket';
import { useAuthStore } from '../../features/auth/authStore';
import type { RootNavigationProp } from '../../types/navigation';

type AvailabilityUpdate = {
  menu_id: string;
  available_quantity: number;
};

export default function MenuListScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { isManager } = useRole();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const {
    pendingMenus,
    menuItems,
    syncStatus,
    syncError,
    syncPending,
    retryFailedSync,
    getPendingCount,
    fetchMenus,
  } = useMenuStore();

  const [refreshing, setRefreshing] = useState(false);
  const [liveAvailability, setLiveAvailability] = useState<
    Record<string, number>
  >({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socket = getSocket('/menu');

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onAvailability = (data: AvailabilityUpdate) => {
      if (!data?.menu_id) return;
      setLiveAvailability((prev) => ({
        ...prev,
        [data.menu_id]: data.available_quantity,
      }));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('menu_availability_updated', onAvailability);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('menu_availability_updated', onAvailability);
    };
  }, [token, isAuthenticated]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([syncPending(), fetchMenus()]);
    setRefreshing(false);
  }, [syncPending, fetchMenus]);

  // Show server list + any pending (not yet synced) items
  const listData = useMemo(() => {
    const pendingCodes = new Set(pendingMenus.map((p) => p.menu_code));
    const server = menuItems.filter((m) => !pendingCodes.has(m.menu_code));
    return [...pendingMenus, ...server];
  }, [pendingMenus, menuItems]);

  const renderItem = ({ item }: { item: MenuItem }) => {
    const key = item.menu_id || item.menu_code;
    const available =
      liveAvailability[key] ??
      liveAvailability[item.menu_code] ??
      item.available_quantity ??
      (item.is_available ? 1 : 0);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.menuName}>{item.name}</Text>
          <Text style={styles.price}>
            KES {Number(item.selling_price).toLocaleString('en-KE')}
          </Text>
        </View>
        <Text style={styles.category}>{item.category || 'Uncategorized'}</Text>

        <Text
          style={[
            styles.status,
            { color: available > 0 ? colors.success : colors.danger },
          ]}
        >
          Available: {available}
          {available === 0 ? ' (Out of Stock)' : ''}
          {!item.menu_id ? ' · Pending sync' : ''}
        </Text>

        {item.preparation_time_minutes ? (
          <Text style={styles.info}>
            Prep: {item.preparation_time_minutes} min
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={typography.title}>Menu Items (Live)</Text>
        <Text
          style={[
            styles.connection,
            { color: connected ? colors.success : colors.danger },
          ]}
        >
          {connected ? '● LIVE' : '○ Offline'}
        </Text>
      </View>

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
              ? `Syncing ${getPendingCount()} menu item(s)...`
              : syncStatus === 'success'
                ? '✅ Synced successfully!'
                : `❌ ${syncError || 'Sync failed'}`}
          </Text>
          {syncStatus === 'error' && (
            <TouchableOpacity onPress={retryFailedSync}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={listData}
        keyExtractor={(item, index) =>
          item.menu_id || item.menu_code || String(index)
        }
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={
          listData.length === 0 ? styles.emptyList : undefined
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No menu items yet</Text>
            <Text style={styles.emptySubText}>Create your first menu item</Text>
          </View>
        }
      />

      {isManager && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateMenu')}
        >
          <Text style={styles.fabText}>+ New Menu Item</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  connection: { fontWeight: 'bold', fontSize: 14 },
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
  menuName: { ...typography.body, fontWeight: '600' },
  price: { ...typography.body, color: colors.primary, fontWeight: '600' },
  category: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  status: { ...typography.small, marginTop: spacing.sm, fontWeight: '600' },
  info: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyList: { flexGrow: 1 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: { ...typography.body, color: colors.textSecondary },
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
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
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
  retryText: { color: colors.primary, fontWeight: 'bold' },
});