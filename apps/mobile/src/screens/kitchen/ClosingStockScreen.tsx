// apps/mobile/src/screens/kitchen/ClosingStockScreen.tsx
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchClosingStock,
  submitClosingStock,
  type ClosingStockLine,
} from '../../api/closingStockApi';
import { colors, spacing, typography } from '../../lib/theme';

const DEFAULT_SHOP_ID = '1';

export default function ClosingStockScreen() {
  const [lines, setLines] = useState<ClosingStockLine[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchClosingStock(DEFAULT_SHOP_ID);
      setLines(data);
      const next: Record<string, string> = {};
      for (const row of data) {
        next[row.itemId] =
          row.countedQty != null ? String(row.countedQty) : '';
      }
      setCounts(next);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load closing stock';
      setError(message);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const completedCount = lines.filter((l) =>
    (counts[l.itemId] ?? '').trim(),
  ).length;

  async function handleSubmit() {
    const payload = lines
      .map((l) => {
        const raw = (counts[l.itemId] ?? '').trim();
        if (!raw) return null;
        const countedQty = Number(raw);
        if (!Number.isFinite(countedQty)) return null;
        return { itemId: l.itemId, countedQty };
      })
      .filter((x): x is { itemId: string; countedQty: number } => x !== null);

    if (payload.length === 0) {
      Alert.alert('Nothing to submit', 'Enter at least one counted quantity.');
      return;
    }

    setSubmitting(true);
    try {
      await submitClosingStock(DEFAULT_SHOP_ID, payload);
      Alert.alert('Submitted', 'Closing stock count saved.');
      await load();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Submit failed';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && lines.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.hint}>Loading stock for count…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.help}>
        System quantities are filled in. Enter only what you counted.
      </Text>
      <Text style={styles.meta}>
        {completedCount} of {lines.length} counted
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={lines}
        keyExtractor={(item) => item.itemId}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.hint}>No stock items to count</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.name}>{item.name || item.itemId}</Text>
              <Text style={styles.system}>
                System: {item.systemQty} {item.unit}
              </Text>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="Counted"
              placeholderTextColor={colors.textSecondary}
              value={counts[item.itemId] ?? ''}
              onChangeText={(text) =>
                setCounts((prev) => ({ ...prev, [item.itemId]: text }))
              }
            />
          </View>
        )}
      />

      <TouchableOpacity
        style={[
          styles.submit,
          (submitting || completedCount === 0) && styles.submitDisabled,
        ]}
        onPress={handleSubmit}
        disabled={submitting || completedCount === 0}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Submit closing stock</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  help: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  meta: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
  },
  system: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  input: {
    width: 100,
    borderWidth: 1,
    borderColor: colors.border ?? '#ddd',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: 'right',
    color: colors.text ?? '#111',
    backgroundColor: colors.background,
  },
  submit: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});