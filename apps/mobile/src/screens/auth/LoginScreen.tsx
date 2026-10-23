// apps/mobile/src/screens/auth/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, typography } from '../../lib/theme';
import { useAuthStore } from '../../features/auth/authStore';
import type { RootNavigationProp } from '../../types/navigation';

export default function LoginScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { login, isLoading, isAuthenticated, error: storeError } =
    useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('StockOverview');
    }
  }, [isAuthenticated, navigation]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }

    setError(null);

    try {
      await login(email.trim().toLowerCase(), password);
      // On success, isAuthenticated becomes true → useEffect navigates
      const afterError = useAuthStore.getState().error;
      if (afterError) {
        setError(afterError);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : storeError || 'Login failed. Please try again.';
      setError(message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={typography.title}>RestFlow Login</Text>
        <Text style={styles.subtitle}>Sign in to manage your kitchen</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.form}>
          <Text style={typography.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />

          <Text style={typography.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            disabled={isLoading}
          >
            <Text style={styles.link}>Don't have an account? Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  link: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.lg,
    fontSize: 16,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontSize: 15,
  },
});