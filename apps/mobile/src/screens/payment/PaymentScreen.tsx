// apps/mobile/src/screens/payment/PaymentScreen.tsx
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { useMpesaPayment } from '../../features/payment/useMpesaPayment';
import { colors, spacing, typography } from '../../lib/theme';
import type {
  RootNavigationProp,
  RootStackParamList,
} from '../../types/navigation';

type PaymentRoute = RouteProp<RootStackParamList, 'Payment'>;

export default function PaymentScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<PaymentRoute>();

  const { order_id, amount } = route.params;

  const { payWithMpesa, loading } = useMpesaPayment();
  const [phone, setPhone] = useState('254');

  const handleMpesaPayment = async () => {
    if (!/^254\d{9}$/.test(phone.trim())) {
      Alert.alert('Invalid Phone', 'Use format 254XXXXXXXXX (12 digits)');
      return;
    }

    if (!order_id || amount == null || amount <= 0) {
      Alert.alert('Invalid Order', 'Missing order or amount');
      return;
    }

    try {
      await payWithMpesa(order_id, phone.trim(), amount);
      Alert.alert('STK Push Sent', 'Check your phone for the M-Pesa prompt');
      navigation.navigate('PaymentSuccess', { order_id });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Please try again';
      Alert.alert('Payment Failed', message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={typography.title}>Complete Payment</Text>

        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount to Pay</Text>
          <Text style={styles.amount}>
            KES {Number(amount).toLocaleString('en-KE')}
          </Text>
          <Text style={styles.orderId}>Order: {order_id}</Text>
        </View>

        <View style={styles.form}>
          <Text style={typography.label}>M-Pesa Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="254712345678"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={12}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleMpesaPayment}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Pay with M-Pesa</Text>
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
  amountCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountLabel: { ...typography.small, color: colors.textSecondary },
  amount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: spacing.xs,
  },
  orderId: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  form: { marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  button: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});