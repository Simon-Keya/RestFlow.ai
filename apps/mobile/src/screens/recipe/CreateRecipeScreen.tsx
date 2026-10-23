// apps/mobile/src/screens/recipe/CreateRecipeScreen.tsx
import React, { useState } from 'react';
import {
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
import { useRecipeStore } from '../../features/recipe/recipeStore';
import { colors, spacing, typography } from '../../lib/theme';

export default function CreateRecipeScreen() {
  const navigation = useNavigation();
  const { addRecipe } = useRecipeStore();

  const [form, setForm] = useState({
    item_id: '',
    item_name: '',
    standard_yield: '',
    unit: '',
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
    if (!form.standard_yield.trim() || parseFloat(form.standard_yield) <= 0) {
      newErrors.standard_yield = 'Valid yield is required';
    }
    if (!form.unit.trim()) newErrors.unit = 'Unit is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the highlighted fields');
      return;
    }

    addRecipe({
      item_id: form.item_id.trim(),
      item_name: form.item_name.trim(),
      standard_yield: parseFloat(form.standard_yield),
      unit: form.unit.trim(),
      notes: form.notes.trim() || undefined,
    });

    Alert.alert('Success', 'Recipe has been queued for sync.');
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={typography.title}>Create New Recipe</Text>

        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={typography.label}>Item ID *</Text>
            <TextInput
              style={[styles.input, errors.item_id && styles.inputError]}
              placeholder="e.g. PIZ001"
              value={form.item_id}
              onChangeText={(v) => handleChange('item_id', v)}
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
            {errors.item_name && <Text style={styles.errorText}>{errors.item_name}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Standard Yield *</Text>
            <TextInput
              style={[styles.input, errors.standard_yield && styles.inputError]}
              placeholder="12 (portions)"
              value={form.standard_yield}
              onChangeText={(v) => handleChange('standard_yield', v)}
              keyboardType="numeric"
            />
            {errors.standard_yield && <Text style={styles.errorText}>{errors.standard_yield}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Unit *</Text>
            <TextInput
              style={[styles.input, errors.unit && styles.inputError]}
              placeholder="portion, pizza, plate..."
              value={form.unit}
              onChangeText={(v) => handleChange('unit', v)}
            />
            {errors.unit && <Text style={styles.errorText}>{errors.unit}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={typography.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Special instructions or description..."
              value={form.notes}
              onChangeText={(v) => handleChange('notes', v)}
              multiline
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>Save Recipe</Text>
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
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  errorText: { color: colors.danger, fontSize: 14, marginTop: spacing.xs },
});