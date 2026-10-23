// apps/mobile/src/screens/recipe/RecipeDetailScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '../../lib/theme';
import { useRole } from '../../hooks/useRole';
import apiClient from '../../api/apiClient';
import { API_ENDPOINTS } from '../../api/endpoints';

type RootStackParamList = { RecipeDetail: { recipe: any } };
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RecipeDetail'>;

export default function RecipeDetailScreen() {
  const { canEditRecipe } = useRole();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { recipe: initial } = route.params as { recipe: any };
  const [recipe, setRecipe] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [itemId, setItemId] = useState('');
  const [itemName, setItemName] = useState('');
  const [standardYield, setStandardYield] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!recipe) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Recipe not found</Text>
      </View>
    );
  }

  const recipeKey = recipe.recipe_id || recipe.recipeId || recipe.id || recipe.item_id;

  function startEdit() {
    setItemId(String(recipe.item_id || recipe.itemId || ''));
    setItemName(String(recipe.item_name || recipe.name || ''));
    setStandardYield(String(recipe.standard_yield ?? recipe.standardYield ?? ''));
    setUnit(String(recipe.unit || 'portion'));
    setNotes(String(recipe.notes || ''));
    setErrors({});
    setEditing(true);
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!itemId.trim()) next.item_id = 'Item ID / SKU is required';
    if (!itemName.trim()) next.item_name = 'Item name is required';
    if (!standardYield.trim() || Number(standardYield) <= 0) next.standard_yield = 'Valid yield is required';
    if (!unit.trim()) next.unit = 'Unit is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate() || busy) return;
    if (!recipeKey) {
      Alert.alert('Cannot save', 'This recipe has no id yet.');
      return;
    }
    setBusy(true);
    try {
      await apiClient.put(API_ENDPOINTS.RECIPE_DETAIL(String(recipeKey)), {
        item_id: itemId.trim(),
        item_name: itemName.trim(),
        standard_yield: Number(standardYield),
        unit: unit.trim(),
        notes: notes.trim() || null,
        yield_quantity: Number(standardYield),
        yield_unit: unit.trim(),
      });
      setRecipe({
        ...recipe,
        item_id: itemId.trim(),
        item_name: itemName.trim(),
        standard_yield: Number(standardYield),
        unit: unit.trim(),
        notes: notes.trim() || undefined,
      });
      setEditing(false);
      Alert.alert('Recipe updated', 'Changes saved successfully.');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string | string[] } }; message?: string };
      const raw = err.response?.data?.message;
      Alert.alert('Save failed', Array.isArray(raw) ? raw.join(', ') : raw || err.message || 'Could not update recipe');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={typography.title}>{editing ? 'Edit recipe' : recipe.item_name || recipe.name}</Text>
          <Text style={styles.recipeId}>Recipe ID: {recipe.recipe_id || recipe.recipeId || recipe.id || 'N/A'}</Text>
        </View>
        {editing ? (
          <View style={styles.form}>
            <Text style={typography.small}>Same fields as Create — including SKU.</Text>
            <View style={styles.formGroup}>
              <Text style={typography.label}>Item ID / SKU *</Text>
              <TextInput style={[styles.input, errors.item_id && styles.inputError]} value={itemId} onChangeText={setItemId} autoCapitalize="characters" editable={!busy} />
              {errors.item_id ? <Text style={styles.errorText}>{errors.item_id}</Text> : null}
            </View>
            <View style={styles.formGroup}>
              <Text style={typography.label}>Item Name *</Text>
              <TextInput style={[styles.input, errors.item_name && styles.inputError]} value={itemName} onChangeText={setItemName} editable={!busy} />
              {errors.item_name ? <Text style={styles.errorText}>{errors.item_name}</Text> : null}
            </View>
            <View style={styles.formGroup}>
              <Text style={typography.label}>Standard Yield *</Text>
              <TextInput style={[styles.input, errors.standard_yield && styles.inputError]} value={standardYield} onChangeText={setStandardYield} keyboardType="numeric" editable={!busy} />
              {errors.standard_yield ? <Text style={styles.errorText}>{errors.standard_yield}</Text> : null}
            </View>
            <View style={styles.formGroup}>
              <Text style={typography.label}>Unit *</Text>
              <TextInput style={[styles.input, errors.unit && styles.inputError]} value={unit} onChangeText={setUnit} editable={!busy} />
              {errors.unit ? <Text style={styles.errorText}>{errors.unit}</Text> : null}
            </View>
            <View style={styles.formGroup}>
              <Text style={typography.label}>Notes</Text>
              <TextInput style={styles.input} value={notes} onChangeText={setNotes} editable={!busy} />
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelButton} disabled={busy} onPress={() => setEditing(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editButton} disabled={busy} onPress={() => void handleSave()}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.editButtonText}>Save changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.infoCard}>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>Item ID / SKU</Text>
                  <Text style={styles.value}>{recipe.item_id || recipe.itemId || '—'}</Text>
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>Standard Yield</Text>
                  <Text style={styles.value}>{recipe.standard_yield ?? recipe.standardYield} {recipe.unit}</Text>
                </View>
              </View>
              {recipe.notes ? (
                <View style={styles.notesSection}>
                  <Text style={styles.label}>Notes</Text>
                  <Text style={styles.notes}>{recipe.notes}</Text>
                </View>
              ) : null}
            </View>
            <Text style={typography.subtitle}>Ingredients</Text>
            <View style={styles.ingredientsContainer}>
              {recipe.ingredients && recipe.ingredients.length > 0 ? (
                recipe.ingredients.map((ing: any, index: number) => (
                  <View key={index} style={styles.ingredientRow}>
                    <Text style={styles.ingredientName}>{ing.raw_item_name || ing.rawItemName}</Text>
                    <Text style={styles.ingredientQty}>{ing.quantity_per_unit ?? ing.quantityPerUnit} {ing.unit}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No ingredients listed on this record.</Text>
              )}
            </View>
            {canEditRecipe ? (
              <TouchableOpacity style={styles.editButton} onPress={startEdit}>
                <Text style={styles.editButtonText}>Edit Recipe</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: spacing.lg },
  recipeId: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
  form: { gap: spacing.md },
  formGroup: { marginBottom: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  infoCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.border,
  },
  row: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md },
  half: { flex: 1 },
  label: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.xs },
  value: { ...typography.body, fontWeight: '600' },
  notesSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  notes: { ...typography.small, fontStyle: 'italic', color: colors.textSecondary },
  ingredientsContainer: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.border,
  },
  ingredientRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  ingredientName: { ...typography.body, flex: 1 },
  ingredientQty: { ...typography.body, fontWeight: '600', color: colors.primary },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', padding: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  editButton: {
    flex: 1, backgroundColor: colors.primary, paddingVertical: spacing.md,
    borderRadius: 12, alignItems: 'center',
  },
  editButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cancelButton: {
    flex: 1, backgroundColor: colors.danger, paddingVertical: spacing.md,
    borderRadius: 12, alignItems: 'center',
  },
  cancelButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  errorText: { color: colors.danger, fontSize: 13, marginTop: 4 },
});
