// apps/mobile/src/screens/finished-goods/FinishedGoodsScreen.tsx
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

import { useFinishedGoodsStore } from '../../features/finished-goods/finishedGoodsStore';
import { useOfflineStore } from '../../features/offline/offlineStore';
import { colors, spacing, typography } from '../../lib/theme';

export default function FinishedGoodsScreen() {
  const { addFinishedGood, isSubmitting } = useFinishedGoodsStore();
  const pendingCount = useOfflineStore((s) =>
    s.queue.filter((q) => q.module === 'finished_goods').length,
  );
  const syncNow = useOfflineStore((s) => s.syncNow);
  const isSyncing = useOfflineStore((s) => s.isSyncing);

  const [form, setForm] = useState({
    item_id: '',
    item_name: '',
    quantity: '',
    batch_number: '',
    expiry_date: '',
    unit_cost: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.item_id.trim()) newErrors.item_id = 'Item ID is required';
    if (!form.item_name.trim()) newErrors.item_name = 'Item name is required';
    if (!form.quantity.trim() || parseFloat(form.quantity) <= 0) {
      newErrors.quantity = 'Quantity must be positive';
    }
    if (!form.batch_number.trim()) newErrors.batch_number = 'Batch number is required';
    if (!form.expiry_date.trim()) newErrors.expiry_date = 'Expiry date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setForm({
      item_id: '',
      item_name: '',
      quantity: '',
      batch_number: '',
      expiry_date: '',
      unit_cost: '',
      notes: '',
    });
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the highlighted fields');
      return;
    }

    const qty = parseFloat(form.quantity);
    const unitCost = parseFloat(form.unit_cost) || 0;

    const result = await addFinishedGood({
      item_id: form.item_id.trim(),
      item_name: form.item_name.trim(),
      quantity: qty,
      batch_number: form.batch_number.trim(),
      expiry_date: form.expiry_date.trim(),
      unit_cost: unitCost,
      total_cost: qty * unitCost,
      notes: form.notes.trim() || undefined,
    });

    if (result.success) {
      Alert.alert(result.offline ? 'Saved Offline' : 'Success', result.message);
      resetForm();
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
              {pendingCount} pending finished good{pendingCount !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={() => syncNow()} disabled={isSyncing}>
              <Text style={styles.retryText}>
                {isSyncing ? 'Syncing...' : 'Sync now'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={typography.title}>Add Finished Goods</Text>

        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={typography.label}>Item ID *</Text>
            <TextInput
              style={[styles.input, errors.item_id && styles.inputError]}
              placeholder="e.g. PIZ001"
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
              placeholder="e.g. Margherita Pizza"
              value={form.item_name}
              onChangeText={(v) => handleChange('item_name', v)}
            />
            {errors.item_name && (
              <Text style={styles.errorText}>{errors.item_name}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Quantity *</Text>
            <TextInput
              style={[styles.input, errors.quantity && styles.inputError]}
              placeholder="20"
              value={form.quantity}
              onChangeText={(v) => handleChange('quantity', v)}
              keyboardType="numeric"
            />
            {errors.quantity && (
              <Text style={styles.errorText}>{errors.quantity}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Batch Number *</Text>
            <TextInput
              style={[styles.input, errors.batch_number && styles.inputError]}
              placeholder="BATCH-2026-001"
              value={form.batch_number}
              onChangeText={(v) => handleChange('batch_number', v)}
              autoCapitalize="characters"
            />
            {errors.batch_number && (
              <Text style={styles.errorText}>{errors.batch_number}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Expiry Date *</Text>
            <TextInput
              style={[styles.input, errors.expiry_date && styles.inputError]}
              placeholder="YYYY-MM-DD"
              value={form.expiry_date}
              onChangeText={(v) => handleChange('expiry_date', v)}
            />
            {errors.expiry_date && (
              <Text style={styles.errorText}>{errors.expiry_date}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Unit Cost (KES)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={form.unit_cost}
              onChangeText={(v) => handleChange('unit_cost', v)}
              keyboardType="decimal-pad"
            />
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
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Add Finished Goods</Text>
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
  errorText: { color: colors.danger, fontSize: 14, marginTop: spacing.xs },
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
});