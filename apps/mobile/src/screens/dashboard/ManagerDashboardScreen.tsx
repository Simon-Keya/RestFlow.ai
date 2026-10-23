// apps/mobile/src/screens/dashboard/ManagerDashboardScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, typography } from '../../lib/theme';
import { useRole } from '../../hooks/useRole';
import type { RootNavigationProp } from '../../types/navigation';

export default function ManagerDashboardScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { isManager } = useRole();

  if (!isManager) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>This dashboard is only for managers</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={typography.title}>Manager Dashboard</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('StockOverview')}
      >
        <Text style={styles.cardTitle}>Stock Overview</Text>
        <Text style={styles.cardDesc}>View current inventory levels</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Receive')}
      >
        <Text style={styles.cardTitle}>Receive Goods</Text>
        <Text style={styles.cardDesc}>Record new stock arrivals</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => canUsePos && navigation.navigate('PosOrder')}
      >
        <Text style={styles.cardTitle}>POS Orders</Text>
        <Text style={styles.cardDesc}>Review recent sales</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  message: {
    fontSize: 18,
    textAlign: 'center',
    color: colors.danger,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});