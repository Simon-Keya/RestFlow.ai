// apps/mobile/src/components/common/Input.tsx
import React from 'react';
import { TextInput, StyleSheet, View, Text, TextInputProps } from 'react-native';
import { colors, spacing, typography } from '../../lib/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: object;
}

export default function Input({
  label,
  error,
  containerStyle,
  ...props
}: InputProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={typography.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholderTextColor={colors.textSecondary}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.danger,
    borderWidth: 2,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    marginTop: spacing.xs,
  },
});