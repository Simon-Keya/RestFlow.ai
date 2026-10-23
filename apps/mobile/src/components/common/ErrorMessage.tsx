// apps/mobile/src/components/common/ErrorMessage.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../lib/theme';

interface ErrorMessageProps {
  message: string;
  retry?: () => void;
}

export default function ErrorMessage({ message, retry }: ErrorMessageProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message}>{message}</Text>
      {retry ? (
        <TouchableOpacity style={styles.retryButton} onPress={retry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  icon: { fontSize: 48, marginBottom: spacing.md },
  message: {
    fontSize: 16,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});