// apps/mobile/src/components/inventory/ReceiveForm.tsx
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing, typography } from '../../lib/theme';

interface ReceiveFormProps {
  form: {
    item_id: string;
    item_name: string;
    units: string;
    quantity: string;
    quantity_approved: string;
    quantity_rejected: string;
    date_received: string;
    expiry_date: string;
    unit_cost: string;
    total_cost: string;
    supplier_name: string;
    supplier_number: string;
    supplier_id: string;
    approved_by: string;
    batch_number: string;
  };
  onChange: (field: keyof ReceiveFormProps['form'], value: string) => void;
  errors?: { [key: string]: string };
}

export default function ReceiveForm({ form, onChange, errors = {} }: ReceiveFormProps) {
  return (
    <View style={styles.form}>
      {/* Item ID */}
      <View style={styles.formGroup}>
        <Text style={typography.label}>Item ID *</Text>
        <TextInput
          style={[styles.input, errors.item_id && styles.inputError]}
          placeholder="e.g. ST300"
          value={form.item_id}
          onChangeText={(v) => onChange('item_id', v)}
          autoCapitalize="characters"
        />
        {errors.item_id && <Text style={styles.errorText}>{errors.item_id}</Text>}
      </View>

      {/* Item Name */}
      <View style={styles.formGroup}>
        <Text style={typography.label}>Item Name *</Text>
        <TextInput
          style={[styles.input, errors.item_name && styles.inputError]}
          placeholder="e.g. exe flour"
          value={form.item_name}
          onChangeText={(v) => onChange('item_name', v)}
        />
        {errors.item_name && <Text style={styles.errorText}>{errors.item_name}</Text>}
      </View>

      {/* Units */}
      <View style={styles.formGroup}>
        <Text style={typography.label}>Units *</Text>
        <TextInput
          style={[styles.input, errors.units && styles.inputError]}
          placeholder="KG, L, pcs..."
          value={form.units}
          onChangeText={(v) => onChange('units', v)}
          autoCapitalize="characters"
        />
        {errors.units && <Text style={styles.errorText}>{errors.units}</Text>}
      </View>

      {/* Quantity group */}
      <View style={styles.rowGroup}>
        <View style={styles.half}>
          <Text style={typography.label}>Quantity Rcvd *</Text>
          <TextInput
            style={[styles.input, errors.quantity && styles.inputError]}
            placeholder="50"
            value={form.quantity}
            onChangeText={(v) => onChange('quantity', v)}
            keyboardType="numeric"
          />
          {errors.quantity && <Text style={styles.errorText}>{errors.quantity}</Text>}
        </View>

        <View style={styles.half}>
          <Text style={typography.label}>Approved</Text>
          <TextInput
            style={styles.input}
            placeholder="50"
            value={form.quantity_approved}
            onChangeText={(v) => onChange('quantity_approved', v)}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={typography.label}>Rejected</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          value={form.quantity_rejected}
          onChangeText={(v) => onChange('quantity_rejected', v)}
          keyboardType="numeric"
        />
      </View>

      {/* Dates */}
      <View style={styles.rowGroup}>
        <View style={styles.half}>
          <Text style={typography.label}>Date Received *</Text>
          <TextInput
            style={[styles.input, errors.date_received && styles.inputError]}
            placeholder="YYYY-MM-DD"
            value={form.date_received}
            onChangeText={(v) => onChange('date_received', v)}
          />
          {errors.date_received && <Text style={styles.errorText}>{errors.date_received}</Text>}
        </View>

        <View style={styles.half}>
          <Text style={typography.label}>Expiry Date *</Text>
          <TextInput
            style={[styles.input, errors.expiry_date && styles.inputError]}
            placeholder="YYYY-MM-DD"
            value={form.expiry_date}
            onChangeText={(v) => onChange('expiry_date', v)}
          />
          {errors.expiry_date && <Text style={styles.errorText}>{errors.expiry_date}</Text>}
        </View>
      </View>

      {/* Cost */}
      <View style={styles.rowGroup}>
        <View style={styles.half}>
          <Text style={typography.label}>Unit Cost (KES) *</Text>
          <TextInput
            style={[styles.input, errors.unit_cost && styles.inputError]}
            placeholder="6.8"
            value={form.unit_cost}
            onChangeText={(v) => onChange('unit_cost', v)}
            keyboardType="decimal-pad"
          />
          {errors.unit_cost && <Text style={styles.errorText}>{errors.unit_cost}</Text>}
        </View>

        <View style={styles.half}>
          <Text style={typography.label}>Total Cost (KES)</Text>
          <TextInput
            style={styles.input}
            placeholder="Auto-calculated"
            value={form.total_cost}
            editable={false}
          />
        </View>
      </View>

      {/* Supplier */}
      <View style={styles.formGroup}>
        <Text style={typography.label}>Supplier Name / Number</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Name e.g. MX"
            value={form.supplier_name}
            onChangeText={(v) => onChange('supplier_name', v)}
          />
          <TextInput
            style={[styles.input, { flex: 1, marginLeft: spacing.sm }]}
            placeholder="Number e.g. 22"
            value={form.supplier_number}
            onChangeText={(v) => onChange('supplier_number', v)}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={typography.label}>Supplier ID (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. MX"
          value={form.supplier_id}
          onChangeText={(v) => onChange('supplier_id', v)}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={typography.label}>Approved By</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. DONDO"
          value={form.approved_by}
          onChangeText={(v) => onChange('approved_by', v)}
        />
      </View>

      {/* Batch */}
      <View style={styles.formGroup}>
        <Text style={typography.label}>Batch Number *</Text>
        <TextInput
          style={[styles.input, errors.batch_number && styles.inputError]}
          placeholder="e.g. BATCH-2026-001"
          value={form.batch_number}
          onChangeText={(v) => onChange('batch_number', v)}
          autoCapitalize="characters"
        />
        {errors.batch_number && <Text style={styles.errorText}>{errors.batch_number}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: spacing.md },
  formGroup: { marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowGroup: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  half: { flex: 1 },
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
  errorText: { color: colors.danger, fontSize: 14, marginTop: spacing.xs },
});