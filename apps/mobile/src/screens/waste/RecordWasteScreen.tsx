// apps/mobile/src/screens/waste/RecordWasteScreen.tsx
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

import { useWasteStore } from '../../features/waste/wasteStore';
import { useOfflineStore } from '../../features/offline/offlineStore';
import { colors, spacing, typography } from '../../lib/theme';

const WASTE_TYPES = [
  'spoilage',
  'damage',
  'theft',
  'shrinkage',
  'quality_reject',
  'production_reject',
  'other',
] as const;

export default function RecordWasteScreen() {
  const { recordWaste, isSubmitting } = useWasteStore();
  const pendingCount = useOfflineStore((s) =>
    s.queue.filter((q) => q.module === 'waste').length,
  );
  const syncNow = useOfflineStore((s) => s.syncNow);
  const isSyncing = useOfflineStore((s) => s.isSyncing);

  const [form, setForm] = useState({
    item_id: '',
    item_name: '',
    batch_number: '',
    quantity_wasted: '',
    unit_of_measure: '',
    unit_cost: '',
    waste_type: 'spoilage' as (typeof WASTE_TYPES)[number],
    waste_reason: '',
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
    if (!form.quantity_wasted.trim() || parseFloat(form.quantity_wasted) <= 0) {
      newErrors.quantity_wasted = 'Quantity must be positive';
    }
    if (!form.unit_of_measure.trim()) {
      newErrors.unit_of_measure = 'Unit is required';
    }
    if (!form.waste_reason.trim()) {
      newErrors.waste_reason = 'Reason is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setForm({
      item_id: '',
      item_name: '',
      batch_number: '',
      quantity_wasted: '',
      unit_of_measure: '',
      unit_cost: '',
      waste_type: 'spoilage',
      waste_reason: '',
      notes: '',
    });
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the highlighted fields');
      return;
    }

    const qty = parseFloat(form.quantity_wasted);
    const unitCost = parseFloat(form.unit_cost) || 0;
    const totalValue = qty * unitCost;

    const result = await recordWaste({
      module_source: 'manual',
      item_id: form.item_id.trim(),
      item_name: form.item_name.trim(),
      batch_number: form.batch_number.trim() || undefined,
      quantity_wasted: qty,
      unit_of_measure: form.unit_of_measure.trim(),
      unit_cost: unitCost,
      total_waste_value: totalValue,
      waste_type: form.waste_type,
      waste_reason: form.waste_reason.trim(),
      root_cause: 'unknown',
      severity: totalValue > 5000 ? 'critical' : totalValue > 1000 ? 'high' : 'medium',
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
              {pendingCount} pending waste record{pendingCount !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={() => syncNow()} disabled={isSyncing}>
              <Text style={styles.retryText}>
                {isSyncing ? 'Syncing...' : 'Sync now'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={typography.title}>Record Waste</Text>

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
            <Text style={typography.label}>Batch Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional"
              value={form.batch_number}
              onChangeText={(v) => handleChange('batch_number', v)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Quantity Wasted *</Text>
            <TextInput
              style={[styles.input, errors.quantity_wasted && styles.inputError]}
              placeholder="5"
              value={form.quantity_wasted}
              onChangeText={(v) => handleChange('quantity_wasted', v)}
              keyboardType="numeric"
            />
            {errors.quantity_wasted && (
              <Text style={styles.errorText}>{errors.quantity_wasted}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Unit *</Text>
            <TextInput
              style={[styles.input, errors.unit_of_measure && styles.inputError]}
              placeholder="KG, L, pcs..."
              value={form.unit_of_measure}
              onChangeText={(v) => handleChange('unit_of_measure', v)}
            />
            {errors.unit_of_measure && (
              <Text style={styles.errorText}>{errors.unit_of_measure}</Text>
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
            <Text style={typography.label}>Waste Type</Text>
            <View style={styles.typeRow}>
              {WASTE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    form.waste_type === type && styles.typeChipActive,
                  ]}
                  onPress={() => handleChange('waste_type', type)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      form.waste_type === type && styles.typeChipTextActive,
                    ]}
                  >
                    {type.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Reason *</Text>
            <TextInput
              style={[styles.input, errors.waste_reason && styles.inputError]}
              placeholder="e.g. Packaging damaged"
              value={form.waste_reason}
              onChangeText={(v) => handleChange('waste_reason', v)}
            />
            {errors.waste_reason && (
              <Text style={styles.errorText}>{errors.waste_reason}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Notes</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Optional details"
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
              <Text style={styles.buttonText}>Record Waste</Text>
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
    backgroundColor: colors.danger,
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
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: { fontSize: 12, color: colors.textPrimary, textTransform: 'capitalize' },
  typeChipTextActive: { color: '#fff' },
});