// apps/mobile/src/components/common/LogoutButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuthStore } from '../../features/auth/authStore';
import { colors, spacing } from '../../lib/theme';
import type { RootNavigationProp } from '../../types/navigation';

export default function LogoutButton() {
  const { logout } = useAuthStore();
  const navigation = useNavigation<RootNavigationProp>();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch {
              Alert.alert('Error', 'Failed to logout. Try again.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handleLogout}>
      <Text style={styles.buttonText}>Logout</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.danger,
    borderRadius: 8,
    marginRight: spacing.md,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});