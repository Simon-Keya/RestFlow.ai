// apps/mobile/src/screens/notifications/NotificationSettings.tsx
import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography } from '../../lib/theme';

export default function NotificationSettingsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [expiryAlerts, setExpiryAlerts] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [wasteSummary, setWasteSummary] = useState(true);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={typography.title}>Notifications</Text>
      <Text style={[typography.subtitle, styles.subtitle]}>
        Control what alerts you receive
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>
        <View style={styles.row}>
          <Text style={typography.label}>Push Notifications</Text>
          <Switch
            value={pushEnabled}
            onValueChange={setPushEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={pushEnabled ? '#fff' : colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inventory Alerts</Text>
        <View style={styles.row}>
          <Text style={typography.label}>Expiry Warnings (7 days)</Text>
          <Switch
            value={expiryAlerts}
            onValueChange={setExpiryAlerts}
            trackColor={{ false: colors.border, true: colors.warning }}
          />
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={typography.label}>Low Stock Alerts</Text>
          <Switch
            value={lowStockAlerts}
            onValueChange={setLowStockAlerts}
            trackColor={{ false: colors.border, true: colors.warning }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Summaries</Text>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={typography.label}>Waste Heatmap Summary</Text>
          <Switch
            value={wasteSummary}
            onValueChange={setWasteSummary}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  subtitle: { marginBottom: spacing.lg, color: colors.textSecondary },
  section: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    ...typography.label,
    fontWeight: '700',
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
});