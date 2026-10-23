// apps/mobile/src/screens/profile/ProfileScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useAuthStore } from '../../features/auth/authStore';
import { colors, spacing, typography } from '../../lib/theme';
import LogoutButton from '../../components/common/LogoutButton';

export default function ProfileScreen() {
  const { user } = useAuthStore();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.title}>Profile</Text>

        {user ? (
          <View style={styles.userInfo}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{user.name}</Text>

            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user.email}</Text>

            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoValue}>{user.role}</Text>
          </View>
        ) : (
          <Text style={styles.noUser}>Not logged in</Text>
        )}

        <View style={styles.logoutSection}>
          <LogoutButton />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  userInfo: { 
    backgroundColor: colors.surface, 
    borderRadius: 12, 
    padding: spacing.lg, 
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoLabel: { 
    ...typography.label, 
    marginBottom: spacing.xs 
  },
  infoValue: { 
    fontSize: 18, 
    color: colors.textPrimary, 
    marginBottom: spacing.md 
  },
  noUser: { 
    fontSize: 18, 
    color: colors.textSecondary, 
    textAlign: 'center', 
    marginTop: spacing.xl 
  },
  logoutSection: { 
    marginTop: 'auto', 
    paddingBottom: spacing.xl 
  },
});