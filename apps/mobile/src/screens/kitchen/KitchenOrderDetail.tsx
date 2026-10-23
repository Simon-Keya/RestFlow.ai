// apps/mobile/src/screens/kitchen/KitchenOrderDetail.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors, spacing, typography } from '../../lib/theme';
import { KitchenOrder } from '../../types/api'; 
import TimerDisplay from '../../components/kitchen/TimerDisplay';

type Props = {
  order: KitchenOrder | null;
  visible: boolean;
  onClose: () => void;
};

export default function KitchenOrderDetail({ order, visible, onClose }: Props) {
  if (!order) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={typography.title}>Order #{order.order_id}</Text>

          <Text style={styles.meta}>
            Type: {order.order_type.toUpperCase()}
            {order.table_number ? ` • Table ${order.table_number}` : ''}
          </Text>

          {order.started_at && <TimerDisplay startedAt={order.started_at} />}

          <ScrollView style={styles.items}>
            {order.items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemName}>
                  {item.quantity}× {item.menu_name}
                </Text>
                {item.notes && (
                  <Text style={styles.notes}>Note: {item.notes}</Text>
                )}
              </View>
            ))}
          </ScrollView>

          <Text style={styles.total}>Total: KES {order.total_amount}</Text>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  meta: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  items: {
    marginVertical: spacing.md,
  },
  itemRow: {
    marginBottom: spacing.sm,
  },
  itemName: {
    ...typography.body,
    fontWeight: '600',
  },
  notes: {
    ...typography.small,
    color: colors.textSecondary,
  },
  total: {
    ...typography.body,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  closeButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  closeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});