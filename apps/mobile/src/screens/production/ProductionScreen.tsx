// apps/mobile/src/screens/production/ProductionScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuthStore } from '../../features/auth/authStore';
import { useProductionStore } from '../../features/production/productionStore';
import { useOfflineStore } from '../../features/offline/offlineStore';
import { getSocket } from '../../lib/socket';
import apiClient from '../../api/apiClient';
import { colors, spacing, typography } from '../../lib/theme';

type LiveProduction = {
  production_id: string;
  item_name: string;
  planned_quantity: number;
  actual_quantity?: number;
  waste_quantity?: number;
  yield_percentage?: number;
  status: 'in_progress' | 'completed';
  timestamp: string;
};

export default function ProductionScreen() {
  // Auth store uses `token` (not accessToken)
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { startProduction, isSubmitting, getPendingCount } =
    useProductionStore();

  const offlinePendingCount = useOfflineStore(
    (s) => s.queue.filter((q) => q.module === 'production').length,
  );

  const localPendingCount = getPendingCount();
  const pendingCount = Math.max(offlinePendingCount, localPendingCount);

  const [form, setForm] = useState({
    item_id: '',
    item_name: '',
    planned_quantity: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCheckingRecipe, setIsCheckingRecipe] = useState(false);
  const [hasValidRecipe, setHasValidRecipe] = useState(false);
  const [liveProductions, setLiveProductions] = useState<LiveProduction[]>([]);
  const [connected, setConnected] = useState(false);

  // Recipe check (debounced)
  useEffect(() => {
    if (!form.item_id.trim()) {
      setHasValidRecipe(false);
      return;
    }

    setIsCheckingRecipe(true);
    const t = setTimeout(async () => {
      try {
        await apiClient.get(`/recipe/item/${form.item_id.trim()}`);
        setHasValidRecipe(true);
      } catch {
        setHasValidRecipe(false);
      } finally {
        setIsCheckingRecipe(false);
      }
    }, 600);

    return () => clearTimeout(t);
  }, [form.item_id]);

  // Live production socket
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socket = getSocket('/production');

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onStarted = (data: LiveProduction) => {
      setLiveProductions((prev) => [data, ...prev.filter((p) => p.production_id !== data.production_id)]);
    };
    const onFinished = (data: LiveProduction) => {
      setLiveProductions((prev) =>
        prev.map((p) =>
          p.production_id === data.production_id ? { ...p, ...data } : p,
        ),
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('production_started', onStarted);
    socket.on('production_finished', onFinished);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('production_started', onStarted);
      socket.off('production_finished', onFinished);
    };
  }, [token, isAuthenticated]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.item_id.trim()) newErrors.item_id = 'Item ID is required';
    if (!form.item_name.trim()) newErrors.item_name = 'Item name is required';
    if (
      !form.planned_quantity.trim() ||
      Number.isNaN(parseFloat(form.planned_quantity)) ||
      parseFloat(form.planned_quantity) <= 0
    ) {
      newErrors.planned_quantity = 'Planned quantity must be a positive number';
    }
    if (!hasValidRecipe && form.item_id.trim()) {
      newErrors.item_id = 'No recipe found for this item';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStartProduction = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the highlighted fields');
      return;
    }

    const result = await startProduction({
      item_id: form.item_id.trim(),
      item_name: form.item_name.trim(),
      planned_quantity: parseFloat(form.planned_quantity),
      notes: form.notes.trim() || undefined,
    });

    if (result.success) {
      Alert.alert(
        result.offline ? 'Saved Offline' : 'Success',
        result.message,
      );
      setForm({ item_id: '', item_name: '', planned_quantity: '', notes: '' });
      setErrors({});
      setHasValidRecipe(false);
    } else {
      Alert.alert('Error', result.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={typography.title}>Start Production</Text>
        <Text style={styles.connection}>
          {connected ? '● Live' : '○ Connecting...'}
          {pendingCount > 0 ? `  ·  ${pendingCount} pending` : ''}
        </Text>

        {liveProductions.length > 0 && (
          <>
            <Text style={[typography.subtitle, { marginBottom: spacing.sm }]}>
              Live runs
            </Text>
            <FlatList
              data={liveProductions}
              keyExtractor={(item) => item.production_id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.liveCard}>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                  <Text style={styles.meta}>
                    Planned: {item.planned_quantity} · Status: {item.status}
                    {item.yield_percentage != null
                      ? ` · Yield: ${item.yield_percentage}%`
                      : ''}
                  </Text>
                </View>
              )}
            />
          </>
        )}

        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={typography.label}>Item ID *</Text>
            <TextInput
              style={[styles.input, errors.item_id && styles.inputError]}
              placeholder="e.g. ST300"
              value={form.item_id}
              onChangeText={(v) => handleChange('item_id', v)}
              autoCapitalize="characters"
            />
            {isCheckingRecipe && (
              <Text style={styles.checkingText}>Checking recipe...</Text>
            )}
            {errors.item_id ? (
              <Text style={styles.errorText}>{errors.item_id}</Text>
            ) : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Item Name *</Text>
            <TextInput
              style={[styles.input, errors.item_name && styles.inputError]}
              placeholder="e.g. Dough Balls"
              value={form.item_name}
              onChangeText={(v) => handleChange('item_name', v)}
            />
            {errors.item_name ? (
              <Text style={styles.errorText}>{errors.item_name}</Text>
            ) : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Planned Quantity *</Text>
            <TextInput
              style={[
                styles.input,
                errors.planned_quantity && styles.inputError,
              ]}
              placeholder="100"
              value={form.planned_quantity}
              onChangeText={(v) => handleChange('planned_quantity', v)}
              keyboardType="numeric"
            />
            {errors.planned_quantity ? (
              <Text style={styles.errorText}>{errors.planned_quantity}</Text>
            ) : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Notes</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Optional notes"
              value={form.notes}
              onChangeText={(v) => handleChange('notes', v)}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              (!hasValidRecipe || isSubmitting) && styles.buttonDisabled,
            ]}
            onPress={handleStartProduction}
            disabled={!hasValidRecipe || isSubmitting || !form.item_id.trim()}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {!hasValidRecipe && form.item_id
                  ? 'No Recipe Found'
                  : 'Start Production'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  connection: { color: colors.textSecondary, marginBottom: spacing.md },
  form: { marginTop: spacing.md },
  formGroup: { marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputError: { borderColor: colors.danger, borderWidth: 2 },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  errorText: { color: colors.danger, fontSize: 14, marginTop: spacing.xs },
  checkingText: { color: colors.primary, fontSize: 13, marginTop: spacing.xs },
  liveCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemName: { fontWeight: '600', color: colors.textPrimary },
  meta: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
});