// apps/mobile/src/screens/refill/RefillRequestScreen.tsx
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useRefillStore } from '../../features/refill/refillStore';
import { useOfflineStore } from '../../features/offline/offlineStore';
import { colors, spacing, typography } from '../../lib/theme';

export default function RefillRequestScreen() {
  const { submitRefillRequest, isSubmitting } = useRefillStore();
  const pendingCount = useOfflineStore((s) =>
    s.queue.filter((q) => q.module === 'refill').length,
  );
  const syncNow = useOfflineStore((s) => s.syncNow);
  const isSyncing = useOfflineStore((s) => s.isSyncing);

  const [form, setForm] = useState({
    item_id: '',
    item_name: '',
    units: '',
    requested_qty: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.item_id.trim()) newErrors.item_id = 'Item ID is required';
    if (!form.item_name.trim()) newErrors.item_name = 'Item name is required';
    if (!form.units.trim()) newErrors.units = 'Units are required';
    if (!form.requested_qty.trim() || parseFloat(form.requested_qty) <= 0) {
      newErrors.requested_qty = 'Requested quantity must be positive';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the highlighted fields');
      return;
    }

    const result = await submitRefillRequest({
      item_id: form.item_id.trim(),
      item_name: form.item_name.trim(),
      units: form.units.trim(),
      requested_qty: parseFloat(form.requested_qty),
      notes: form.notes.trim() || undefined,
    });

    if (result.success) {
      Alert.alert(
        result.offline ? 'Saved Offline' : 'Success',
        result.message,
      );
      setForm({
        item_id: '',
        item_name: '',
        units: '',
        requested_qty: '',
        notes: '',
      });
      setErrors({});
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
        {pendingCount > 0 && (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingCount}>
              {pendingCount} pending refill request
              {pendingCount !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={() => syncNow()} disabled={isSyncing}>
              <Text style={styles.retryText}>
                {isSyncing ? 'Syncing...' : 'Sync now'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={typography.title}>Request Refill</Text>

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
            {errors.item_id && <Text style={styles.errorText}>{errors.item_id}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Item Name *</Text>
            <TextInput
              style={[styles.input, errors.item_name && styles.inputError]}
              placeholder="e.g. Exe Flour"
              value={form.item_name}
              onChangeText={(v) => handleChange('item_name', v)}
            />
            {errors.item_name && (
              <Text style={styles.errorText}>{errors.item_name}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Units *</Text>
            <TextInput
              style={[styles.input, errors.units && styles.inputError]}
              placeholder="KG, L, pcs..."
              value={form.units}
              onChangeText={(v) => handleChange('units', v)}
              autoCapitalize="characters"
            />
            {errors.units && <Text style={styles.errorText}>{errors.units}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Requested Quantity *</Text>
            <TextInput
              style={[styles.input, errors.requested_qty && styles.inputError]}
              placeholder="50"
              value={form.requested_qty}
              onChangeText={(v) => handleChange('requested_qty', v)}
              keyboardType="numeric"
            />
            {errors.requested_qty && (
              <Text style={styles.errorText}>{errors.requested_qty}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Any special instructions..."
              value={form.notes}
              onChangeText={(v) => handleChange('notes', v)}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Submit Refill Request</Text>
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  pendingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
  },
  pendingCount: { color: colors.textSecondary, fontSize: 14 },
  retryText: { color: colors.primary, fontWeight: 'bold' },
  errorText: { color: colors.danger, fontSize: 14, marginTop: spacing.xs },
});