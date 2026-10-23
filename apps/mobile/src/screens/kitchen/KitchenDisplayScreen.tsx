// apps/mobile/src/screens/kitchen/KitchenDisplayScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { useAuthStore } from '../../features/auth/authStore';
import { useKitchenStore } from '../../features/kitchen/kitchenStore';
import type { KitchenOrder, OrderStatus } from '../../types/api';
import { colors, spacing, typography } from '../../lib/theme';
import { getSocket } from '../../lib/socket';
import OrderCard from '../../components/kitchen/OrderCard';
import KitchenOrderDetail from './KitchenOrderDetail';

export default function KitchenDisplayScreen() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const {
    orders,
    selectedOrder,
    addOrder,
    updateOrderStatus,
    setSelectedOrder,
  } = useKitchenStore();

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const socket = getSocket('/pos');

    const onConnect = () => {
      setConnected(true);
      socket.emit('join_kitchen');
    };
    const onDisconnect = () => setConnected(false);
    const onNewOrder = (order: KitchenOrder) => {
      addOrder(order);
    };
    const onStatusUpdated = (data: {
      order_id: string;
      status: OrderStatus;
    }) => {
      updateOrderStatus(data.order_id, data.status);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('kitchen_new_order', onNewOrder);
    socket.on('order_status_updated', onStatusUpdated);

    if (socket.connected) {
      setConnected(true);
      socket.emit('join_kitchen');
    }

    setLoading(false);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('kitchen_new_order', onNewOrder);
      socket.off('order_status_updated', onStatusUpdated);
      // do not disconnect shared socket — leave for other screens
    };
  }, [token, isAuthenticated, addOrder, updateOrderStatus]);

  const handleStatusChange = (order_id: string, status: OrderStatus) => {
    updateOrderStatus(order_id, status);
    const socket = getSocket('/pos');
    socket.emit('update_order_status', { order_id, status });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const activeOrders = orders.filter((o) => o.status !== 'ready');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={typography.title}>Kitchen Display</Text>
        <Text
          style={[
            styles.connection,
            { color: connected ? colors.success : colors.danger },
          ]}
        >
          {connected ? '● LIVE' : '○ Offline'}
        </Text>
      </View>

      <Text style={styles.subtitle}>
        Active Orders ({activeOrders.length})
      </Text>

      <FlatList
        data={activeOrders}
        keyExtractor={(item) => item.order_id}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => setSelectedOrder(item)}
            onStatusChange={(status) =>
              handleStatusChange(item.order_id, status)
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No active orders</Text>
            <Text style={styles.emptySub}>
              New orders will appear here live
            </Text>
          </View>
        }
      />

      <KitchenOrderDetail
        order={selectedOrder}
        visible={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
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
  connection: {
    fontWeight: '700',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    marginTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  emptySub: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});