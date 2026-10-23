// apps/mobile/src/components/kitchen/StatusButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { spacing } from '../../lib/theme';

type Props = {
  label: string;
  color: string;
  onPress: () => void;
};

export default function StatusButton({ label, color, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});