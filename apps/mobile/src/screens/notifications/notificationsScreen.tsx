// apps/mobile/src/screens/notifications/NotificationsScreen.tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNotificationsStore } from '../../features/notifications/notificationsStore';
import { colors, spacing, typography } from '../../lib/theme';

export default function NotificationsScreen() {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotificationsStore();

  const renderNotification = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.card, item.read && styles.read]}
      onPress={() => markAsRead(item.id)}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={[styles.type, { color: getTypeColor(item.type) }]}>
          {item.type.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.message}>{item.message}</Text>
      <Text style={styles.timestamp}>
        {new Date(item.timestamp).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  const getTypeColor = (type: string) => {
    if (type === 'critical') return colors.danger;
    if (type === 'warning') return colors.warning;
    return colors.primary;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={typography.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        ListEmptyComponent={
          <Text style={styles.empty}>No notifications yet</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  markAll: { color: colors.primary, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  read: { opacity: 0.7 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: { ...typography.body, fontWeight: '600' },
  type: { fontWeight: '700', fontSize: 12 },
  message: { ...typography.small, marginBottom: spacing.sm },
  timestamp: { ...typography.small, color: colors.textSecondary },
  empty: { textAlign: 'center', marginTop: 100, color: colors.textSecondary },
});