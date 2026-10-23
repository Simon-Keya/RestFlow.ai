// apps/mobile/src/components/common/Button.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, typography } from '../../lib/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  style?: object;
}

export default function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
}: ButtonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary };
      case 'danger':
        return { backgroundColor: colors.danger };
      case 'success':
        return { backgroundColor: colors.success };
      default:
        return { backgroundColor: colors.primary };
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getVariantStyles(),
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[
          styles.buttonText,
          variant === 'secondary' && { color: colors.primary },
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});