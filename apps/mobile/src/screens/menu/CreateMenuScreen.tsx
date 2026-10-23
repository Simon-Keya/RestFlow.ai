// apps/mobile/src/screens/menu/CreateMenuScreen.tsx
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
import { useNavigation } from '@react-navigation/native';

import { useMenuStore } from '../../features/menu/menuStore';
import { colors, spacing, typography } from '../../lib/theme';
import type { RootNavigationProp } from '../../types/navigation';

export default function CreateMenuScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { submitMenu, isSubmitting } = useMenuStore();

  const [form, setForm] = useState({
    menu_code: '',
    name: '',
    category: '',
    selling_price: '',
    tax_rate: '16',
    preparation_time_minutes: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.menu_code.trim()) newErrors.menu_code = 'Menu code is required';
    if (!form.name.trim()) newErrors.name = 'Menu name is required';
    if (
      !form.selling_price.trim() ||
      Number.isNaN(parseFloat(form.selling_price)) ||
      parseFloat(form.selling_price) <= 0
    ) {
      newErrors.selling_price = 'Valid selling price is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the highlighted fields');
      return;
    }

    const result = await submitMenu({
      menu_code: form.menu_code.trim(),
      name: form.name.trim(),
      category: form.category.trim() || undefined,
      selling_price: parseFloat(form.selling_price),
      tax_rate: parseFloat(form.tax_rate) || 16,
      preparation_time_minutes: form.preparation_time_minutes
        ? parseInt(form.preparation_time_minutes, 10)
        : undefined,
      notes: form.notes.trim() || undefined,
      is_available: true,
      is_visible: true,
    });

    if (result.success) {
      Alert.alert(result.offline ? 'Saved Offline' : 'Success', result.message);
      navigation.goBack();
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
        <Text style={typography.title}>Create Menu Item</Text>

        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={typography.label}>Menu Code *</Text>
            <TextInput
              style={[styles.input, errors.menu_code && styles.inputError]}
              placeholder="MENU001"
              value={form.menu_code}
              onChangeText={(v) => handleChange('menu_code', v)}
              autoCapitalize="characters"
            />
            {errors.menu_code ? (
              <Text style={styles.errorText}>{errors.menu_code}</Text>
            ) : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Menu Name *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="e.g. Margherita Pizza"
              value={form.name}
              onChangeText={(v) => handleChange('name', v)}
            />
            {errors.name ? (
              <Text style={styles.errorText}>{errors.name}</Text>
            ) : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Category</Text>
            <TextInput
              style={styles.input}
              placeholder="Pizza, Burgers, Drinks..."
              value={form.category}
              onChangeText={(v) => handleChange('category', v)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Selling Price (KES) *</Text>
            <TextInput
              style={[styles.input, errors.selling_price && styles.inputError]}
              placeholder="650"
              value={form.selling_price}
              onChangeText={(v) => handleChange('selling_price', v)}
              keyboardType="numeric"
            />
            {errors.selling_price ? (
              <Text style={styles.errorText}>{errors.selling_price}</Text>
            ) : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Tax Rate (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="16"
              value={form.tax_rate}
              onChangeText={(v) => handleChange('tax_rate', v)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Prep Time (minutes)</Text>
            <TextInput
              style={styles.input}
              placeholder="15"
              value={form.preparation_time_minutes}
              onChangeText={(v) => handleChange('preparation_time_minutes', v)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Notes</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Description or special instructions..."
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
              <Text style={styles.buttonText}>Save Menu Item</Text>
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
});