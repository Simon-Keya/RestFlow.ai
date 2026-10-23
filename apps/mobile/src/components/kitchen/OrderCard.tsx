// apps/mobile/src/components/kitchen/OrderCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography } from '../../lib/theme';
import type { KitchenOrder, OrderItem } from '../../types/kitchen';
import TimerDisplay from './TimerDisplay';
import StatusButton from './StatusButton';

type Props = {
  order: KitchenOrder;
  onPress: () => void;
  onStatusChange: (status: KitchenOrder['status']) => void;
};

export default function OrderCard({ order, onPress, onStatusChange }: Props) {
  const getStatusColor = () => {
    if (order.status === 'pending') return colors.warning;
    if (order.status === 'preparing') return colors.primary;
    return colors.success;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <Text style={styles.orderId}>#{order.order_id}</Text>
        <Text style={[styles.status, { color: getStatusColor() }]}>
          {order.status.toUpperCase()}
        </Text>
      </View>

      {order.table_number ? (
        <Text style={styles.meta}>Table: {order.table_number}</Text>
      ) : null}
      {order.customer_name ? (
        <Text style={styles.meta}>Customer: {order.customer_name}</Text>
      ) : null}

      <View style={styles.items}>
        {order.items.map((item: OrderItem, idx: number) => (
          <Text key={`${item.menu_id}-${idx}`} style={styles.item}>
            {item.quantity}× {item.menu_name}
            {item.notes ? ` (${item.notes})` : ''}
          </Text>
        ))}
      </View>

      {order.started_at ? <TimerDisplay startedAt={order.started_at} /> : null}

      <View style={styles.actions}>
        {order.status === 'pending' ? (
          <StatusButton
            label="Start Preparing"
            color={colors.primary}
            onPress={() => onStatusChange('preparing')}
          />
        ) : null}
        {order.status === 'preparing' ? (
          <StatusButton
            label="Mark Ready"
            color={colors.success}
            onPress={() => onStatusChange('ready')}
          />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  orderId: { ...typography.body, fontWeight: '700' },
  status: { fontWeight: '700', fontSize: 13 },
  meta: { ...typography.small, color: colors.textSecondary },
  items: { marginVertical: spacing.sm },
  item: { ...typography.body, marginBottom: 2 },
  actions: { marginTop: spacing.sm },
});